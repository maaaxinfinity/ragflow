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
from flask import request
from flask_login import login_required, current_user
from api.db.services.free_chat_user_settings_service import FreeChatUserSettingsService
from api.db.services.user_service import UserTenantService
from api.db.services.dialog_service import DialogService
from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response, validate_request
from api.db.db_models import APIToken
from api.db import UserTenantRole
from api import settings


def verify_team_access(user_id: str, current_tenant_id: str = None) -> tuple[bool, str]:
    """
    Verify if the user_id has access within the current team/tenant.

    Args:
        user_id: External user ID from free chat
        current_tenant_id: Current user's tenant ID (if authenticated)

    Returns:
        (is_authorized, error_message)
    """
    try:
        # If no tenant_id provided, try to get from current_user
        if not current_tenant_id:
            if current_user and current_user.is_authenticated:
                tenants = UserTenantService.query(user_id=current_user.id)
                if not tenants:
                    return False, "User not associated with any tenant"
                current_tenant_id = tenants[0].tenant_id
            else:
                return False, "Authentication required"

        # Check if user_id settings exist and belong to the same tenant
        exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
        if exists and setting.dialog_id and setting.dialog_id.strip():
            # Verify the dialog belongs to the current tenant
            dialogs = DialogService.query(id=setting.dialog_id, tenant_id=current_tenant_id)
            if not dialogs:  # dialogs is a list, check if empty
                return False, "User does not belong to your team"

        # If no settings exist yet, allow access (first time user)
        # They will be associated with the tenant when they save settings
        return True, ""

    except Exception as e:
        return False, f"Authorization check failed: {str(e)}"


@manager.route("/free_chat/settings", methods=["GET"])  # noqa: F821
@login_required
def get_user_settings():
    """Get free chat settings for a user (team access required)"""
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return get_data_error_result(message="user_id is required")

        # Get current user's tenant
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")

        current_tenant_id = tenants[0].tenant_id

        # Verify team access
        is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
        if not is_authorized:
            return get_data_error_result(
                message=error_msg,
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
        if exists:
            return get_json_result(data=setting.to_dict())
        else:
            # Return default settings
            return get_json_result(data={
                "user_id": user_id,
                "dialog_id": "",
                "model_params": {"temperature": 0.7, "top_p": 0.9},
                "kb_ids": [],
                "role_prompt": "",
                "sessions": []
            })
    except Exception as e:
        return server_error_response(e)


@manager.route("/free_chat/settings", methods=["POST", "PUT"])  # noqa: F821
@login_required
@validate_request("user_id")
def save_user_settings():
    """Save/update free chat settings for a user (team access required)"""
    try:
        req = request.json
        user_id = req.get("user_id")

        # Get current user's tenant
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")

        current_tenant_id = tenants[0].tenant_id

        # Verify team access
        is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
        if not is_authorized:
            return get_data_error_result(
                message=error_msg,
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        # Extract settings
        data = {
            "dialog_id": req.get("dialog_id", ""),
            "model_params": req.get("model_params", {}),
            "kb_ids": req.get("kb_ids", []),
            "role_prompt": req.get("role_prompt", ""),
            "sessions": req.get("sessions", [])
        }

        # Verify dialog belongs to current tenant if provided
        if data["dialog_id"]:
            dialog = DialogService.query(id=data["dialog_id"], tenant_id=current_tenant_id)
            if not dialog:
                return get_data_error_result(
                    message="Selected dialog does not belong to your team",
                    code=settings.RetCode.AUTHENTICATION_ERROR
                )

        success, result = FreeChatUserSettingsService.upsert(user_id, **data)
        if success:
            return get_json_result(data=result.to_dict())
        else:
            return get_data_error_result(message=f"Failed to save settings: {result}")
    except Exception as e:
        return server_error_response(e)


@manager.route("/free_chat/settings/<user_id>", methods=["DELETE"])  # noqa: F821
@login_required
def delete_user_settings(user_id):
    """Delete free chat settings for a user (team access required)"""
    try:
        # Get current user's tenant
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="User not associated with any tenant")

        current_tenant_id = tenants[0].tenant_id

        # Verify team access
        is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
        if not is_authorized:
            return get_data_error_result(
                message=error_msg,
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        success = FreeChatUserSettingsService.delete_by_user_id(user_id)
        if success:
            return get_json_result(data=True)
        else:
            return get_data_error_result(message="Failed to delete settings or user not found")
    except Exception as e:
        return server_error_response(e)


@manager.route("/free_chat/admin_token", methods=["GET"])  # noqa: F821
@login_required
def get_admin_token():
    """Get admin API token for the current user's tenant"""
    try:
        from flask_login import current_user

        # Get user's tenant
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="Tenant not found")

        tenant_id = tenants[0].tenant_id

        # Check if user is team admin
        from api.db import UserTenantRole
        if tenants[0].role != UserTenantRole.OWNER:
            # User is not admin, try to get team admin's token
            # Get team owner
            team_admins = UserTenantService.query(tenant_id=tenant_id, role=UserTenantRole.OWNER)
            if not team_admins:
                return get_data_error_result(message="Team admin not found")
            tenant_id = team_admins[0].tenant_id

        # Get or create API token for this tenant
        tokens = APIToken.query(tenant_id=tenant_id)
        if tokens:
            # Return first available token
            return get_json_result(data={"token": tokens[0].token})
        else:
            # No token found
            return get_data_error_result(message="No API token found. Please create one in settings.")
    except Exception as e:
        return server_error_response(e)
