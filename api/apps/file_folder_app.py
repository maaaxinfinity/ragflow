#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
import os
from flask import request, Blueprint
from flask_login import login_required, current_user
from api.db import FileType
from api.db.services import duplicate_name
from api.db.services.file_service import FileService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.document_service import DocumentService
from api.db.services.file2document_service import File2DocumentService
from api.utils import get_uuid
from api.utils.api_utils import get_json_result, get_data_error_result, validate_request
from api.utils.file_utils import filename_type
from rag.utils.storage_factory import STORAGE_IMPL
from api import settings
import logging

# Blueprint for folder upload and knowledge base creation
manager = Blueprint('file_folder', __name__)

@manager.route('/upload_folder', methods=['POST'])
@login_required
def upload_folder():
    """
    Upload multiple files with folder structure preserved
    Returns a tree structure of uploaded files and folders
    """
    parent_id = request.form.get("parent_id")
    folder_paths = request.form.getlist('folder_path')  # Array of relative paths

    if not parent_id:
        root_folder = FileService.get_root_folder(current_user.id)
        if root_folder:
            parent_id = root_folder.get("id") if isinstance(root_folder, dict) else root_folder.id
        else:
            return get_json_result(
                data=False, message='Root folder not found!', code=settings.RetCode.DATA_ERROR)

    if 'files' not in request.files:
        return get_json_result(
            data=False, message='No files uploaded!', code=settings.RetCode.ARGUMENT_ERROR)

    file_objs = request.files.getlist('files')

    if len(file_objs) != len(folder_paths):
        return get_json_result(
            data=False, message='Files and paths mismatch!', code=settings.RetCode.ARGUMENT_ERROR)

    # Build folder structure map
    folder_map = {parent_id: parent_id}  # Map from path to folder ID
    created_files = []
    created_folders = []

    try:
        # Process files by path depth to ensure parent folders are created first
        files_with_paths = list(zip(file_objs, folder_paths))
        files_with_paths.sort(key=lambda x: x[1].count('/'))

        for file_obj, folder_path in files_with_paths:
            # Parse folder structure from path
            path_parts = folder_path.split('/')
            file_name = path_parts[-1]
            folder_parts = path_parts[:-1] if len(path_parts) > 1 else []

            # Create folder structure if needed
            current_parent_id = parent_id
            current_path = ""

            for folder_name in folder_parts:
                if not folder_name:
                    continue

                current_path = current_path + "/" + folder_name if current_path else folder_name

                if current_path not in folder_map:
                    # Check if folder exists
                    existing_folder = FileService.query(
                        name=folder_name,
                        parent_id=current_parent_id,
                        type=FileType.FOLDER.value
                    )

                    if existing_folder:
                        folder_id = existing_folder[0].id
                    else:
                        # Create new folder
                        folder_data = {
                            "id": get_uuid(),
                            "parent_id": current_parent_id,
                            "tenant_id": current_user.id,
                            "created_by": current_user.id,
                            "type": FileType.FOLDER.value,
                            "name": folder_name,
                            "location": "",
                            "size": 0,
                            "folder_path": current_path
                        }
                        folder = FileService.insert(folder_data)
                        folder_id = folder.id
                        created_folders.append(folder.to_json())

                    folder_map[current_path] = folder_id
                    current_parent_id = folder_id
                else:
                    current_parent_id = folder_map[current_path]

            # Upload file to the final folder
            file_type = filename_type(file_name)
            location = file_name
            blob = file_obj.read()

            # Check for duplicate file names
            while STORAGE_IMPL.obj_exist(current_parent_id, location):
                location = location + "_"

            # Save file to storage
            STORAGE_IMPL.put(current_parent_id, location, blob)

            # Create file record
            file_data = {
                "id": get_uuid(),
                "parent_id": current_parent_id,
                "tenant_id": current_user.id,
                "created_by": current_user.id,
                "type": file_type,
                "name": duplicate_name(FileService.query, name=file_name, parent_id=current_parent_id),
                "location": location,
                "size": len(blob),
                "folder_path": folder_path
            }
            file = FileService.insert(file_data)
            created_files.append(file.to_json())

        return get_json_result(data={
            "files": created_files,
            "folders": created_folders,
            "total_files": len(created_files),
            "total_folders": len(created_folders)
        })

    except Exception as e:
        logging.error(f"Error uploading folder: {str(e)}")
        return get_data_error_result(message=str(e))


@manager.route('/create_kb_from_folder', methods=['POST'])
@login_required
@validate_request("folder_id", "kb_name")
def create_kb_from_folder():
    """
    Create a knowledge base from all files in a folder (including subfolders)
    """
    req = request.json
    folder_id = req.get("folder_id")
    kb_name = req.get("kb_name")
    description = req.get("description", "")
    parser_id = req.get("parser_id", "naive")

    try:
        # Get the folder
        e, folder = FileService.get_by_id(folder_id)
        if not e:
            return get_data_error_result(message="Folder not found!")

        if folder.type != FileType.FOLDER.value:
            return get_data_error_result(message="Selected item is not a folder!")

        # Create knowledge base
        kb_data = {
            "id": get_uuid(),
            "name": kb_name,
            "description": description,
            "tenant_id": current_user.id,
            "created_by": current_user.id,
            "permission": "me",
            "language": "English",
            "parser_id": parser_id,
            "parser_config": {"pages": [[1, 1000000]]},
            "embd_id": "BAAI/bge-large-en-v1.5"  # Default embedding model
        }

        kb = KnowledgebaseService.save(**kb_data)
        if not kb:
            return get_data_error_result(message="Failed to create knowledge base!")

        # Get all files in folder and subfolders recursively
        files_to_add = []

        def get_files_recursive(parent_id):
            children = FileService.query(parent_id=parent_id)
            for child in children:
                if child.type == FileType.FOLDER.value:
                    get_files_recursive(child.id)
                else:
                    files_to_add.append(child)

        get_files_recursive(folder_id)

        # Add files to knowledge base
        added_documents = []
        for file in files_to_add:
            doc_data = {
                "id": get_uuid(),
                "kb_id": kb_data["id"],
                "parser_id": parser_id,
                "parser_config": {"pages": [[1, 1000000]]},
                "source_type": file.source_type,
                "type": file.type,
                "name": file.name,
                "location": file.location,
                "size": file.size,
                "thumbnail": "",
                "created_by": current_user.id
            }

            doc = DocumentService.save(**doc_data)
            if doc:
                # Link file to document
                File2DocumentService.save(**{
                    "id": get_uuid(),
                    "file_id": file.id,
                    "document_id": doc_data["id"]
                })
                added_documents.append(doc.to_json())

        return get_json_result(data={
            "kb_id": kb_data["id"],
            "kb_name": kb_name,
            "documents_added": len(added_documents),
            "documents": added_documents
        })

    except Exception as e:
        logging.error(f"Error creating KB from folder: {str(e)}")
        return get_data_error_result(message=str(e))


@manager.route('/folder_tree/<folder_id>', methods=['GET'])
@login_required
def get_folder_tree(folder_id):
    """
    Get the tree structure of a folder with all its contents
    """
    try:
        def build_tree(parent_id):
            items = []
            children = FileService.query(parent_id=parent_id)

            for child in children:
                item = {
                    "id": child.id,
                    "name": child.name,
                    "type": child.type,
                    "size": child.size,
                    "created_time": child.create_time
                }

                if child.type == FileType.FOLDER.value:
                    item["children"] = build_tree(child.id)
                    item["file_count"] = len([c for c in item["children"] if c["type"] != FileType.FOLDER.value])
                    item["folder_count"] = len([c for c in item["children"] if c["type"] == FileType.FOLDER.value])

                items.append(item)

            return items

        # Get folder info
        e, folder = FileService.get_by_id(folder_id)
        if not e:
            return get_data_error_result(message="Folder not found!")

        tree = {
            "id": folder.id,
            "name": folder.name,
            "type": folder.type,
            "children": build_tree(folder_id)
        }

        return get_json_result(data=tree)

    except Exception as e:
        logging.error(f"Error getting folder tree: {str(e)}")
        return get_data_error_result(message=str(e))