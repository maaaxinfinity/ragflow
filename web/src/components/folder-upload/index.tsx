import React, { useState, useRef } from 'react';
import { Upload, Button, message, Modal, Input, Form, Select, Progress, Tree } from 'antd';
import { FolderAddOutlined, FolderOpenOutlined, FileOutlined } from '@ant-design/icons';
import { UploadProps } from 'antd/lib/upload';
import request from 'umi-request';

interface FolderUploadProps {
  parentId?: string;
  onSuccess?: (data: any) => void;
}

interface FileWithPath extends File {
  path?: string;
  webkitRelativePath?: string;
}

export const FolderUpload: React.FC<FolderUploadProps> = ({ parentId, onSuccess }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<FileWithPath[]>([]);
  const [folderStructure, setFolderStructure] = useState<any[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = () => {
    // Create hidden input for folder selection
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as FileWithPath[];
      processFiles(files);
    };

    input.click();
  };

  const processFiles = (files: FileWithPath[]) => {
    // Build folder structure from files
    const structure: any = {};

    files.forEach((file) => {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split('/');

      let current = structure;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          if (!current.files) current.files = [];
          current.files.push({
            name: part,
            file: file,
            path: path
          });
        } else {
          // It's a folder
          if (!current.folders) current.folders = {};
          if (!current.folders[part]) {
            current.folders[part] = {};
          }
          current = current.folders[part];
        }
      });
    });

    setFileList(files);
    setFolderStructure(convertToTreeData(structure));
  };

  const convertToTreeData = (structure: any, parentKey = ''): any[] => {
    const treeData: any[] = [];

    // Add folders
    if (structure.folders) {
      Object.entries(structure.folders).forEach(([name, content]) => {
        const key = parentKey ? `${parentKey}/${name}` : name;
        treeData.push({
          title: name,
          key: key,
          icon: <FolderOpenOutlined />,
          children: convertToTreeData(content, key)
        });
      });
    }

    // Add files
    if (structure.files) {
      structure.files.forEach((file: any) => {
        const key = parentKey ? `${parentKey}/${file.name}` : file.name;
        treeData.push({
          title: file.name,
          key: key,
          icon: <FileOutlined />,
          isLeaf: true
        });
      });
    }

    return treeData;
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select files to upload');
      return;
    }

    setUploading(true);
    const formData = new FormData();

    // Add parent ID if provided
    if (parentId) {
      formData.append('parent_id', parentId);
    }

    // Add files and their paths
    fileList.forEach((file) => {
      formData.append('files', file);
      formData.append('folder_path', file.webkitRelativePath || file.name);
    });

    try {
      const response = await request('/v1/file_folder/upload_folder', {
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.code === 0 || response.code === 200) {
        const data = response.data || response;
        message.success(`Successfully uploaded ${data.total_files || 0} files in ${data.total_folders || 0} folders`);
        onSuccess?.(data);
        setFileList([]);
        setFolderStructure([]);
      } else {
        message.error(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="folder-upload">
      <Button
        type="primary"
        icon={<FolderAddOutlined />}
        onClick={handleFolderSelect}
        disabled={uploading}
      >
        Select Folder
      </Button>

      {fileList.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 10 }}>
            Selected {fileList.length} files
          </div>

          <Tree
            treeData={folderStructure}
            defaultExpandAll
            height={300}
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: 8,
              marginBottom: 16
            }}
          />

          {uploading && (
            <Progress percent={uploadProgress} style={{ marginBottom: 16 }} />
          )}

          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
          >
            Upload All Files
          </Button>
        </div>
      )}
    </div>
  );
};

interface CreateKBFromFolderProps {
  visible: boolean;
  folderId: string;
  folderName: string;
  onCancel: () => void;
  onSuccess: (data: any) => void;
}

export const CreateKBFromFolder: React.FC<CreateKBFromFolderProps> = ({
  visible,
  folderId,
  folderName,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await request('/v1/file_folder/create_kb_from_folder', {
        method: 'POST',
        data: {
          folder_id: folderId,
          kb_name: values.kb_name,
          description: values.description || '',
          parser_id: values.parser_id || 'naive',
        },
      });

      if (response.code === 0 || response.code === 200) {
        const data = response.data || response;
        message.success(`Successfully created knowledge base with ${data.documents_added || 0} documents`);
        onSuccess(data);
        form.resetFields();
      } else {
        message.error(response.message || 'Creation failed');
      }
    } catch (error) {
      console.error('KB creation error:', error);
      message.error('Failed to create knowledge base');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Create Knowledge Base from Folder: ${folderName}`}
      open={visible}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={loading}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          kb_name: folderName,
          parser_id: 'naive',
        }}
      >
        <Form.Item
          name="kb_name"
          label="Knowledge Base Name"
          rules={[{ required: true, message: 'Please enter a name' }]}
        >
          <Input placeholder="Enter knowledge base name" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea
            rows={3}
            placeholder="Enter description (optional)"
          />
        </Form.Item>

        <Form.Item
          name="parser_id"
          label="Parser Type"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="naive">General</Select.Option>
            <Select.Option value="paper">Academic Paper</Select.Option>
            <Select.Option value="book">Book</Select.Option>
            <Select.Option value="laws">Legal Document</Select.Option>
            <Select.Option value="manual">Manual/Guide</Select.Option>
            <Select.Option value="qa">Q&A Format</Select.Option>
            <Select.Option value="table">Table/Spreadsheet</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};