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
FreeChat Session & Message API - SQL 作为唯一可信数据源
"""

from flask import request, Blueprint
from flask_login import login_required, current_user
from api.db.services.free_chat_session_service import FreeChatSessionService
from api.db.services.free_chat_message_service import FreeChatMessageService
from api.db.services.user_service import UserTenantService
from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response, validate_request
from api.utils.auth_decorator import api_key_or_login_required
from api import settings
import logging
import time

# Blueprint for free chat sessions and messages
manager = Blueprint('free_chat_session', __name__)


def verify_session_access(session_id: str, current_tenant_id: str) -> tuple[bool, str]:
    """
    验证当前租户是否有权限访问该会话
    
    Args:
        session_id: 会话 ID
        current_tenant_id: 当前租户 ID
    
    Returns:
        (is_authorized, error_message)
    """
    exists, session = FreeChatSessionService.get_by_id(session_id)
    if not exists:
        return False, "Session not found"
    
    # TODO: 实现租户权限验证逻辑
    # 可以通过 user_id 查找 FreeChatUserSettings, 再通过 dialog_id 验证租户
    
    return True, ""


# ==================== Session API ====================

@manager.route("/sessions", methods=["GET"])
@api_key_or_login_required
def list_sessions(**kwargs):
    """
    获取用户的会话列表
    ---
    tags:
      - FreeChat
    parameters:
      - name: user_id
        in: query
        type: string
        required: true
        description: 外部用户 ID
    responses:
      200:
        description: 会话列表
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              name:
                type: string
              conversation_id:
                type: string
              created_at:
                type: integer
              updated_at:
                type: integer
    """
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return get_data_error_result(message="user_id is required")
        
        # 获取租户信息用于权限验证
        auth_method = kwargs.get("auth_method")
        if auth_method == "api_key":
            current_tenant_id = kwargs.get("tenant_id")
        else:
            tenants = UserTenantService.query(user_id=current_user.id)
            if not tenants:
                return get_data_error_result(message="User not associated with any tenant")
            current_tenant_id = tenants[0].tenant_id
        
        # 查询会话列表
        sessions = FreeChatSessionService.list_by_user(user_id)
        session_list = [
            {
                "id": s.id,
                "name": s.name,
                "conversation_id": s.conversation_id,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
                "message_count": FreeChatMessageService.count_by_session(s.id)
            }
            for s in sessions
        ]
        
        return get_json_result(data=session_list)
    except Exception as e:
        return server_error_response(e)


@manager.route("/sessions", methods=["POST"])
@api_key_or_login_required
@validate_request("user_id", "name")
def create_session(**kwargs):
    """
    创建新会话
    ---
    tags:
      - FreeChat
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - user_id
            - name
          properties:
            user_id:
              type: string
            name:
              type: string
            conversation_id:
              type: string
    """
    try:
        req = request.json
        user_id = req.get("user_id")
        name = req.get("name")
        conversation_id = req.get("conversation_id")
        
        # 生成会话 ID
        from api.utils import get_uuid
        session_id = get_uuid()
        created_at = int(time.time() * 1000)
        
        # 创建会话
        success, error_msg = FreeChatSessionService.create_session(
            session_id=session_id,
            user_id=user_id,
            name=name,
            created_at=created_at,
            conversation_id=conversation_id
        )
        
        if success:
            return get_json_result(data={
                "id": session_id,
                "name": name,
                "conversation_id": conversation_id,
                "created_at": created_at,
                "updated_at": created_at
            })
        else:
            return get_data_error_result(message=error_msg)
    except Exception as e:
        return server_error_response(e)


@manager.route("/sessions/<session_id>", methods=["PUT"])
@api_key_or_login_required
def update_session(session_id, **kwargs):
    """
    更新会话（例如重命名）
    """
    try:
        req = request.json
        name = req.get("name")
        conversation_id = req.get("conversation_id")
        
        update_fields = {}
        if name is not None:
            update_fields["name"] = name
        if conversation_id is not None:
            update_fields["conversation_id"] = conversation_id
        
        if not update_fields:
            return get_data_error_result(message="No fields to update")
        
        updated_at = int(time.time() * 1000)
        success, error_msg = FreeChatSessionService.update_session(
            session_id=session_id,
            updated_at=updated_at,
            **update_fields
        )
        
        if success:
            return get_json_result(data=True)
        else:
            return get_data_error_result(message=error_msg)
    except Exception as e:
        return server_error_response(e)


@manager.route("/sessions/<session_id>", methods=["DELETE"])
@api_key_or_login_required
def delete_session(session_id, **kwargs):
    """
    删除会话及其所有消息
    """
    try:
        success, error_msg = FreeChatSessionService.delete_session(session_id)
        
        if success:
            return get_json_result(data=True)
        else:
            return get_data_error_result(message=error_msg)
    except Exception as e:
        return server_error_response(e)


# ==================== Message API ====================

@manager.route("/sessions/<session_id>/messages", methods=["GET"])
@api_key_or_login_required
def list_messages(session_id, **kwargs):
    """
    获取会话的消息列表（支持分页）
    ---
    tags:
      - FreeChat
    parameters:
      - name: session_id
        in: path
        type: string
        required: true
      - name: limit
        in: query
        type: integer
        description: 限制返回数量
      - name: offset
        in: query
        type: integer
        description: 偏移量
    """
    try:
        limit = request.args.get("limit", type=int)
        offset = request.args.get("offset", type=int, default=0)
        
        messages = FreeChatMessageService.list_by_session(session_id, limit=limit, offset=offset)
        message_list = [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "reference": m.reference,
                "seq": m.seq,
                "created_at": m.created_at
            }
            for m in messages
        ]
        
        return get_json_result(data=message_list)
    except Exception as e:
        return server_error_response(e)


@manager.route("/sessions/<session_id>/messages", methods=["POST"])
@api_key_or_login_required
@validate_request("role", "content")
def create_message(session_id, **kwargs):
    """
    在会话中创建新消息
    """
    try:
        req = request.json
        role = req.get("role")
        content = req.get("content")
        reference = req.get("reference", [])
        
        if role not in ["user", "assistant"]:
            return get_data_error_result(message="Invalid role, must be 'user' or 'assistant'")
        
        # 生成消息 ID 和序号
        from api.utils import get_uuid
        message_id = get_uuid()
        seq = FreeChatMessageService.get_next_seq(session_id)
        created_at = int(time.time() * 1000)
        
        # 创建消息
        success, error_msg = FreeChatMessageService.create_message(
            message_id=message_id,
            session_id=session_id,
            role=role,
            content=content,
            seq=seq,
            created_at=created_at,
            reference=reference
        )
        
        if success:
            # 更新会话的 updated_at
            FreeChatSessionService.update_session(session_id, updated_at=created_at)
            
            return get_json_result(data={
                "id": message_id,
                "role": role,
                "content": content,
                "reference": reference,
                "seq": seq,
                "created_at": created_at
            })
        else:
            return get_data_error_result(message=error_msg)
    except Exception as e:
        return server_error_response(e)


@manager.route("/messages/<message_id>", methods=["PUT"])
@api_key_or_login_required
def update_message(message_id, **kwargs):
    """
    更新消息内容
    """
    try:
        req = request.json
        content = req.get("content")
        reference = req.get("reference")
        
        update_fields = {}
        if content is not None:
            update_fields["content"] = content
        if reference is not None:
            update_fields["reference"] = reference
        
        if not update_fields:
            return get_data_error_result(message="No fields to update")
        
        success, error_msg = FreeChatMessageService.update_message(
            message_id=message_id,
            **update_fields
        )
        
        if success:
            return get_json_result(data=True)
        else:
            return get_data_error_result(message=error_msg)
    except Exception as e:
        return server_error_response(e)


@manager.route("/messages/<message_id>", methods=["DELETE"])
@api_key_or_login_required
def delete_message(message_id, **kwargs):
    """
    删除单条消息
    """
    try:
        success, error_msg = FreeChatMessageService.delete_message(message_id)
        
        if success:
            return get_json_result(data=True)
        else:
            return get_data_error_result(message=error_msg)
    except Exception as e:
        return server_error_response(e)
