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
from flask import request, Blueprint
from flask_login import login_required, current_user
from api.db.services.free_chat_user_settings_service import FreeChatUserSettingsService
from api.db.services.user_service import UserTenantService, UserService
from api.db.services.dialog_service import DialogService
from api.db.services.api_service import APITokenService
from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response, validate_request, generate_confirmation_token
from api.utils.auth_decorator import api_key_or_login_required
from api.utils import current_timestamp, datetime_format, get_uuid
from api.db.db_models import APIToken
from api.db import UserTenantRole, StatusEnum
from api import settings
from rag.utils.redis_conn import REDIS_CONN
# ✅ 导入新的异常处理和分布式锁
from api.exceptions.free_chat_exceptions import (
    FreeChatError,
    SettingsNotFoundError,
    UnauthorizedAccessError,
    InvalidSettingsError,
    DatabaseError,
    CacheError,
    LockTimeoutError
)
from api.utils.redis_lock import redis_lock
from datetime import datetime
import json
import logging
import os

# Blueprint for free chat settings and sessions
manager = Blueprint('free_chat', __name__)

# ✅ 注册统一异常处理器
@manager.errorhandler(FreeChatError)
def handle_freechat_error(error: FreeChatError):
    """统一处理 FreeChat 异常"""
    logging.error(f"[FreeChat] {error.error_code}: {error.message}")
    return get_data_error_result(
        message=error.message,
        code=error.status_code
    ), error.status_code

# Redis key prefix for sessions cache
REDIS_SESSION_KEY_PREFIX = "freechat:sessions:"
REDIS_SESSION_TTL = 7 * 24 * 60 * 60  # 7 days


def get_sessions_from_redis(user_id: str):
    """Get sessions from Redis cache (L1 cache)"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        data = REDIS_CONN.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logging.warning(f"[FreeChat] Redis get failed for user {user_id}: {e}")
    return None


def save_sessions_to_redis(user_id: str, sessions: list):
    """Save sessions to Redis cache with TTL"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        REDIS_CONN.set_obj(key, sessions, REDIS_SESSION_TTL)
        logging.info(f"[FreeChat] Cached sessions to Redis for user {user_id}")
    except Exception as e:
        logging.error(f"[FreeChat] Redis save failed for user {user_id}: {e}")


def invalidate_sessions_cache(user_id: str):
    """Invalidate Redis cache for user"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        REDIS_CONN.delete(key)
        logging.info(f"[FreeChat] Invalidated Redis cache for user {user_id}")
    except Exception as e:
        logging.error(f"[FreeChat] Redis delete failed for user {user_id}: {e}")


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
            try:
                dialogs = DialogService.query(id=setting.dialog_id, tenant_id=current_tenant_id)
                if not dialogs:  # dialogs is a list, check if empty
                    return False, "User does not belong to your team"
            except Exception:
                # Dialog not found or other error, treat as unauthorized
                return False, "Dialog not found or user does not belong to your team"

        # If no settings exist yet, allow access (first time user)
        # They will be associated with the tenant when they save settings
        return True, ""

    except Exception as e:
        return False, f"Authorization check failed: {str(e)}"


@manager.route("/settings", methods=["GET"])  # noqa: F821
@api_key_or_login_required
def get_user_settings(**kwargs):
    """Get free chat settings for a user (team access required)"""
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return get_data_error_result(message="user_id is required")

        # Get tenant_id based on authentication method
        auth_method = kwargs.get("auth_method")
        if auth_method == "api_key":
            # API key authentication - tenant_id provided by decorator
            current_tenant_id = kwargs.get("tenant_id")
        else:
            # Session authentication - get tenant from current_user
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

        # Try to get sessions from Redis cache first (L1 cache)
        cached_sessions = get_sessions_from_redis(user_id)

        exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
        if exists:
            result = setting.to_dict()
            # Use cached sessions if available, otherwise use DB sessions
            if cached_sessions is not None:
                result['sessions'] = cached_sessions
                logging.info(f"[FreeChat] Loaded sessions from Redis cache for user {user_id}")
            else:
                # Cache miss, cache the DB sessions to Redis
                save_sessions_to_redis(user_id, result.get('sessions', []))
                logging.info(f"[FreeChat] Loaded sessions from MySQL for user {user_id}")
            return get_json_result(data=result)
        else:
            # Return default settings
            default_settings = {
                "user_id": user_id,
                "dialog_id": "",
                "model_params": {"temperature": 0.7, "top_p": 0.9},
                "kb_ids": [],
                "role_prompt": "",
                "sessions": []
            }
            # Cache default sessions
            save_sessions_to_redis(user_id, [])
            return get_json_result(data=default_settings)
    except Exception as e:
        return server_error_response(e)


@manager.route("/settings", methods=["POST", "PUT"])  # noqa: F821
@api_key_or_login_required
@validate_request("user_id")
def save_user_settings(**kwargs):
    """Save/update free chat settings for a user (team access required)"""
    req = request.json
    user_id = req.get("user_id")
    
    # ✅ 参数验证
    if not user_id:
        raise InvalidSettingsError("user_id is required")

    # Get tenant_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        # API key authentication - tenant_id provided by decorator
        current_tenant_id = kwargs.get("tenant_id")
    else:
        # Session authentication - get tenant from current_user
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            raise UnauthorizedAccessError("User not associated with any tenant")
        current_tenant_id = tenants[0].tenant_id

    # Verify team access
    is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
    if not is_authorized:
        raise UnauthorizedAccessError(error_msg)

    # Extract settings
    data = {
        "dialog_id": req.get("dialog_id", ""),
        "model_params": req.get("model_params", {}),
        "kb_ids": req.get("kb_ids", []),
        "role_prompt": req.get("role_prompt", ""),
        "sessions": req.get("sessions", [])
    }
    logging.info(f"[FreeChat] Received save request for user {user_id}, sessions count: {len(data['sessions'])}")
    if data['sessions']:
        logging.info(f"[FreeChat] First session: id={data['sessions'][0].get('id')}, name={data['sessions'][0].get('name')}")

    # Verify dialog belongs to current tenant if provided
    if data["dialog_id"]:
        dialog = DialogService.query(id=data["dialog_id"], tenant_id=current_tenant_id)
        if not dialog:
            raise UnauthorizedAccessError("Selected dialog does not belong to your team")

    # ✅ 使用分布式锁防止并发冲突
    lock_key = f"freechat_settings:{user_id}"
    try:
        with redis_lock(lock_key, timeout=5, blocking_timeout=3):
            # Step 1: Save sessions to Redis immediately (fast response)
            sessions = data.get("sessions", [])
            try:
                save_sessions_to_redis(user_id, sessions)
                logging.info(f"[FreeChat] Saved sessions to Redis for user {user_id}")
            except Exception as e:
                raise CacheError(f"Failed to save sessions to Redis: {str(e)}")

            # Step 2: Persist to MySQL (guaranteed durability)
            try:
                success, result = FreeChatUserSettingsService.upsert(user_id, **data)
            except Exception as e:
                raise DatabaseError(f"Failed to persist settings to MySQL: {str(e)}")
            
            if success:
                logging.info(f"[FreeChat] Persisted settings to MySQL for user {user_id}")
                result_dict = result.to_dict()
                logging.info(f"[FreeChat] Returning data: sessions count = {len(result_dict.get('sessions', []))}")
                if result_dict.get('sessions'):
                    logging.info(f"[FreeChat] First session name: {result_dict['sessions'][0].get('name', 'N/A')}")
                return get_json_result(data=result_dict)
            else:
                # MySQL save failed, invalidate Redis cache to prevent inconsistency
                invalidate_sessions_cache(user_id)
                logging.error(f"[FreeChat] MySQL save failed, invalidated Redis cache for user {user_id}")
                raise DatabaseError(f"Failed to save settings: {result}")
    
    except LockTimeoutError:
        logging.warning(f"[FreeChat] Lock timeout for user {user_id}, another save is in progress")
        raise
    except (CacheError, DatabaseError, UnauthorizedAccessError, InvalidSettingsError):
        # Re-raise our custom exceptions
        raise
    except Exception as e:
        logging.error(f"[FreeChat] Unexpected error saving settings: {e}")
        raise FreeChatError(f"Unexpected error: {str(e)}")


@manager.route("/settings/<user_id>", methods=["DELETE"])  # noqa: F821
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

        # Delete from MySQL
        success = FreeChatUserSettingsService.delete_by_user_id(user_id)
        if success:
            # Also invalidate Redis cache
            invalidate_sessions_cache(user_id)
            logging.info(f"[FreeChat] Deleted settings and cache for user {user_id}")
            return get_json_result(data=True)
        else:
            return get_data_error_result(message="Failed to delete settings or user not found")
    except Exception as e:
        return server_error_response(e)


@manager.route("/admin_token", methods=["GET"])  # noqa: F821
def get_admin_token():
    """Get admin API token for the current user's tenant"""
    try:
        # 支持多种认证方式
        user = None

        # 方式 1: 检查 Authorization header 中的原始 access_token
        authorization_str = request.headers.get("Authorization")
        if authorization_str:
            parts = authorization_str.split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                access_token = parts[1]
                users = UserService.query(access_token=access_token, status=StatusEnum.VALID.value)
                if users:
                    user = users[0]

        # 方式 2: 检查 Flask-Login session
        if not user:
            if current_user and current_user.is_authenticated:
                user = current_user

        if not user:
            return get_data_error_result(
                message="Authentication required",
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        # Determine tenant_id based on user role:
        # 1. Get ADMIN_EMAIL from environment
        admin_email = os.environ.get("ADMIN_EMAIL")

        if admin_email:
            # 2. Find SU (super user) by email
            su_users = UserService.query(email=admin_email, status=StatusEnum.VALID.value)

            if su_users:
                su_user = su_users[0]
                su_tenant_id = su_user.id  # SU's tenant_id = SU's user_id

                # 3. Check if current user is SU or in SU's team
                if user.id == su_user.id:
                    # Current user IS the SU - use SU's tenant_id
                    tenant_id = su_tenant_id
                    logging.info(f"[FreeChat] User {user.id} is SU, using SU tenant_id: {su_tenant_id}")
                else:
                    # 4. Get SU team members (NORMAL role only, excludes OWNER)
                    su_team_members = UserTenantService.get_by_tenant_id(su_tenant_id)
                    su_member_ids = [member["user_id"] for member in su_team_members]

                    # 5. Check if current user is in SU's team
                    if user.id in su_member_ids:
                        # Team member - use SU's tenant_id
                        tenant_id = su_tenant_id
                        logging.info(f"[FreeChat] User {user.id} is in SU team, using SU tenant_id: {su_tenant_id}")
                    else:
                        # Not in team - deny access and return error
                        logging.warning(f"[FreeChat] User {user.id} is NOT in SU team, access denied")
                        return get_data_error_result(
                            message="Access denied. Only team members can access FreeChat.",
                            code=settings.RetCode.AUTHENTICATION_ERROR
                        )
            else:
                # SU not found, fallback to user's own tenant
                logging.warning(f"[FreeChat] ADMIN_EMAIL {admin_email} not found, using user's own tenant")
                tenants = UserTenantService.query(user_id=user.id)
                if not tenants:
                    return get_data_error_result(message="Tenant not found")
                tenant_id = tenants[0].tenant_id
        else:
            # No ADMIN_EMAIL configured, use user's own tenant
            logging.info(f"[FreeChat] No ADMIN_EMAIL configured, using user's own tenant")
            tenants = UserTenantService.query(user_id=user.id)
            if not tenants:
                return get_data_error_result(message="Tenant not found")
            tenant_id = tenants[0].tenant_id

        # Get or create API token for this tenant
        tokens = APIToken.query(tenant_id=tenant_id)
        if tokens:
            # Return beta token (用于嵌入认证) 和普通 token
            return get_json_result(data={
                "token": tokens[0].beta or tokens[0].token,  # 优先返回 beta token
                "beta": tokens[0].beta,
                "api_key": tokens[0].token
            })
        else:
            # No token found - auto create one for better UX
            logging.info(f"[FreeChat] No API token found for tenant {tenant_id}, creating one automatically")
            try:
                # Generate token and beta token
                token = generate_confirmation_token(tenant_id)
                beta_token = "ragflow-" + get_uuid()[:32]  # Generate beta token for iframe embedding

                # Create API token record
                token_obj = {
                    "tenant_id": tenant_id,
                    "token": token,
                    "beta": beta_token,
                    "dialog_id": None,
                    "source": None,
                    "create_time": current_timestamp(),
                    "create_date": datetime_format(datetime.now()),
                    "update_time": None,
                    "update_date": None
                }

                if not APITokenService.save(**token_obj):
                    logging.error(f"[FreeChat] Failed to auto-create API token for tenant {tenant_id}")
                    return get_data_error_result(message="Failed to create API token automatically")

                logging.info(f"[FreeChat] Successfully auto-created API token for tenant {tenant_id}")
                return get_json_result(data={
                    "token": beta_token,
                    "beta": beta_token,
                    "api_key": token
                })
            except Exception as e:
                logging.error(f"[FreeChat] Error auto-creating API token: {e}")
                return get_data_error_result(message=f"Failed to create API token: {str(e)}")
    except Exception as e:
        return server_error_response(e)
