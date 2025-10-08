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
"""
Admin Cleanup API - For testing and debugging only
Allows superuser to clean up test data
"""

import logging
from flask import Blueprint, request
from api.db.services.conversation_service import ConversationService
from api.db.services.user_service import UserTenantService
from api.utils.api_utils import server_error_response, get_json_result, get_data_error_result
from api.utils.api_utils import get_parser
from api import settings

# Create blueprint for admin cleanup endpoints
manager = Blueprint('admin_cleanup', __name__, url_prefix='/v1/admin/cleanup')


def is_superuser(api_key: str) -> bool:
    """
    Check if the provided API key belongs to a superuser.
    
    For security, this checks if the key matches a specific pattern or is in a whitelist.
    In production, you should use a more secure method.
    """
    # SECURITY: Only allow specific API keys
    # Replace this with your actual superuser key check
    SUPERUSER_KEYS = [
        "Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT",  # Your current test key
    ]
    return api_key in SUPERUSER_KEYS


@manager.route("/conversations", methods=["DELETE"])
def cleanup_conversations():
    """
    Delete all conversations for a specific user or tenant.
    
    **SUPERUSER ONLY** - Requires valid superuser API key.
    
    Query Parameters:
        - tenant_id: Target tenant/user ID (required)
        - confirm: Must be "yes" to proceed (required)
    
    Returns:
        {
            "code": 0,
            "data": {
                "deleted_count": 5,
                "tenant_id": "xxx"
            }
        }
    """
    try:
        # Extract API key from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return get_data_error_result(message="Missing or invalid Authorization header")
        
        api_key = auth_header.replace("Bearer ", "").strip()
        
        # Check superuser permission
        if not is_superuser(api_key):
            logging.warning("[AdminCleanup] Unauthorized cleanup attempt with key: %s...", api_key[:10])
            return get_json_result(
                data=False,
                message="Unauthorized: Superuser access required",
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # Get parameters
        tenant_id = request.args.get("tenant_id")
        confirm = request.args.get("confirm")
        
        # Validate parameters
        if not tenant_id:
            return get_data_error_result(message="tenant_id is required")
        
        if confirm != "yes":
            return get_data_error_result(
                message="Must confirm with ?confirm=yes parameter"
            )
        
        logging.info("[AdminCleanup] Superuser cleanup requested for tenant: %s", tenant_id)
        
        # Find all conversations for this tenant
        # First, get all dialogs for this tenant
        from api.db.services.dialog_service import DialogService
        
        dialogs = DialogService.query(tenant_id=tenant_id)
        if not dialogs:
            logging.info("[AdminCleanup] No dialogs found for tenant %s", tenant_id)
            return get_json_result(data={
                "deleted_count": 0,
                "tenant_id": tenant_id,
                "message": "No dialogs found for this tenant"
            })
        
        # Collect all conversation IDs
        total_deleted = 0
        dialog_ids = [d.id for d in dialogs]
        
        for dialog_id in dialog_ids:
            # Get all conversations for this dialog
            convs = ConversationService.query(dialog_id=dialog_id)
            
            for conv in convs:
                # Delete conversation
                ConversationService.delete_by_id(conv.id)
                total_deleted += 1
                logging.info("[AdminCleanup] Deleted conversation: %s", conv.id)
        
        # Also clear Redis cache if exists
        try:
            from api.db import Redis
            # Clear any cached data for this tenant
            redis_pattern = "*{}*".format(tenant_id)
            # Note: This is a simple cleanup, you might want to be more specific
            logging.info("[AdminCleanup] Redis cleanup pattern: %s", redis_pattern)
        except Exception as e:
            logging.warning("[AdminCleanup] Redis cleanup skipped: %s", str(e))
        
        logging.info("[AdminCleanup] Cleanup completed - deleted %d conversations for tenant %s", total_deleted, tenant_id)
        
        return get_json_result(data={
            "deleted_count": total_deleted,
            "tenant_id": tenant_id,
            "dialog_count": len(dialog_ids)
        })
        
    except Exception as e:
        logging.exception(e)
        return server_error_response(e)


@manager.route("/conversation/<conversation_id>", methods=["DELETE"])
def cleanup_single_conversation(conversation_id):
    """
    Delete a specific conversation and clear its messages.
    
    **SUPERUSER ONLY** - Requires valid superuser API key.
    
    Returns:
        {
            "code": 0,
            "data": {
                "deleted": true,
                "conversation_id": "xxx"
            }
        }
    """
    try:
        # Extract API key from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return get_data_error_result(message="Missing or invalid Authorization header")
        
        api_key = auth_header.replace("Bearer ", "").strip()
        
        # Check superuser permission
        if not is_superuser(api_key):
            logging.warning("[AdminCleanup] Unauthorized cleanup attempt")
            return get_json_result(
                data=False,
                message="Unauthorized: Superuser access required",
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        logging.info("[AdminCleanup] Deleting conversation: %s", conversation_id)
        
        # Get conversation first
        e, conv = ConversationService.get_by_id(conversation_id)
        if not e:
            return get_data_error_result(message="Conversation not found")
        
        # Delete conversation
        ConversationService.delete_by_id(conversation_id)
        
        logging.info("[AdminCleanup] Successfully deleted conversation: %s", conversation_id)
        
        return get_json_result(data={
            "deleted": True,
            "conversation_id": conversation_id
        })
        
    except Exception as e:
        logging.exception(e)
        return server_error_response(e)


@manager.route("/test-reset", methods=["POST"])
def test_reset():
    """
    Reset test environment to clean state.
    
    **SUPERUSER ONLY** - Requires valid superuser API key.
    
    This endpoint:
    1. Deletes all conversations for the test user
    2. Clears Redis cache
    3. Returns statistics
    
    Body:
        {
            "tenant_id": "c06096ce9e3411f09866eedd5edd0033",
            "confirm": "yes"
        }
    
    Returns:
        {
            "code": 0,
            "data": {
                "status": "cleaned",
                "deleted_conversations": 10,
                "redis_cleared": true
            }
        }
    """
    try:
        # Extract API key from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return get_data_error_result(message="Missing or invalid Authorization header")
        
        api_key = auth_header.replace("Bearer ", "").strip()
        
        # Check superuser permission
        if not is_superuser(api_key):
            logging.warning("[AdminCleanup] Unauthorized test-reset attempt")
            return get_json_result(
                data=False,
                message="Unauthorized: Superuser access required",
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # Get request body
        req = request.json
        if not req:
            return get_data_error_result(message="Request body is required")
            
        tenant_id = req.get("tenant_id")
        confirm = req.get("confirm")
        
        # Validate
        if not tenant_id:
            return get_data_error_result(message="tenant_id is required in request body")
        
        if confirm != "yes":
            return get_data_error_result(
                message='Must confirm with "confirm": "yes" in request body'
            )
        
        logging.info("[AdminCleanup] Test reset requested for tenant: %s", tenant_id)
        
        # Delete all conversations
        from api.db.services.dialog_service import DialogService
        
        dialogs = DialogService.query(tenant_id=tenant_id)
        total_deleted = 0
        
        if dialogs:
            dialog_ids = [d.id for d in dialogs]
            
            for dialog_id in dialog_ids:
                convs = ConversationService.query(dialog_id=dialog_id)
                
                for conv in convs:
                    ConversationService.delete_by_id(conv.id)
                    total_deleted += 1
        
        # Clear Redis cache
        redis_cleared = False
        try:
            from api.db import Redis
            # Clear free_chat settings cache
            redis_key = "free_chat:settings:{}".format(tenant_id)
            Redis.delete(redis_key)
            redis_cleared = True
            logging.info("[AdminCleanup] Cleared Redis key: %s", redis_key)
        except Exception as e:
            logging.warning("[AdminCleanup] Redis cleanup failed: %s", str(e))
        
        logging.info("[AdminCleanup] Test reset completed - deleted %d conversations", total_deleted)
        
        return get_json_result(data={
            "status": "cleaned",
            "tenant_id": tenant_id,
            "deleted_conversations": total_deleted,
            "redis_cleared": redis_cleared,
            "message": "Successfully cleaned {} conversations".format(total_deleted)
        })
        
    except Exception as e:
        logging.exception(e)
        return server_error_response(e)
