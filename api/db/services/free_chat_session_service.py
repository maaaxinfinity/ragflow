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
FreeChat Session 服务层 - SQL 作为唯一可信数据源
管理会话的 CRUD 操作
"""

import logging
from typing import List, Optional, Tuple
from api.db.db_models import FreeChatSession
from api.db.services.common_service import CommonService


class FreeChatSessionService(CommonService):
    model = FreeChatSession

    @classmethod
    def get_by_id(cls, session_id: str) -> Tuple[bool, Optional[FreeChatSession]]:
        """
        根据 session_id 查询会话

        Args:
            session_id: 会话 ID

        Returns:
            (exists, session)
        """
        try:
            session = cls.model.get(cls.model.id == session_id)
            return True, session
        except Exception:
            return False, None

    @classmethod
    def list_by_user(cls, user_id: str, order_by_desc: bool = True) -> List[FreeChatSession]:
        """
        查询用户的所有会话列表

        Args:
            user_id: 用户 ID
            order_by_desc: 是否按创建时间倒序

        Returns:
            会话列表
        """
        try:
            query = cls.model.select().where(cls.model.user_id == user_id)
            if order_by_desc:
                query = query.order_by(cls.model.created_at.desc())
            else:
                query = query.order_by(cls.model.created_at.asc())
            return list(query)
        except Exception as e:
            logging.error(f"[FreeChatSessionService] Error listing sessions for user {user_id}: {e}")
            return []

    @classmethod
    def create_session(cls, session_id: str, user_id: str, name: str, created_at: int, 
                      conversation_id: Optional[str] = None) -> Tuple[bool, str]:
        """
        创建新会话

        Args:
            session_id: 会话 ID (UUID)
            user_id: 用户 ID
            name: 会话名称
            created_at: 创建时间戳 (ms)
            conversation_id: 关联的 Conversation ID

        Returns:
            (success, error_message)
        """
        try:
            cls.save(
                id=session_id,
                user_id=user_id,
                name=name,
                conversation_id=conversation_id,
                created_at=created_at,
                updated_at=created_at
            )
            logging.info(f"[FreeChatSessionService] Created session {session_id} for user {user_id}")
            return True, ""
        except Exception as e:
            error_msg = f"Failed to create session: {str(e)}"
            logging.error(f"[FreeChatSessionService] {error_msg}")
            return False, error_msg

    @classmethod
    def update_session(cls, session_id: str, updated_at: int, **kwargs) -> Tuple[bool, str]:
        """
        更新会话

        Args:
            session_id: 会话 ID
            updated_at: 更新时间戳 (ms)
            **kwargs: 要更新的字段 (name, conversation_id等)

        Returns:
            (success, error_message)
        """
        try:
            kwargs['updated_at'] = updated_at
            num = cls.model.update(**kwargs).where(cls.model.id == session_id).execute()
            if num > 0:
                logging.info(f"[FreeChatSessionService] Updated session {session_id}")
                return True, ""
            else:
                return False, "Session not found"
        except Exception as e:
            error_msg = f"Failed to update session: {str(e)}"
            logging.error(f"[FreeChatSessionService] {error_msg}")
            return False, error_msg

    @classmethod
    def delete_session(cls, session_id: str) -> Tuple[bool, str]:
        """
        删除会话 (同时会级联删除所有消息)

        Args:
            session_id: 会话 ID

        Returns:
            (success, error_message)
        """
        try:
            # 先删除关联的消息
            from api.db.services.free_chat_message_service import FreeChatMessageService
            FreeChatMessageService.delete_by_session(session_id)
            
            # 删除会话
            num = cls.model.delete().where(cls.model.id == session_id).execute()
            if num > 0:
                logging.info(f"[FreeChatSessionService] Deleted session {session_id}")
                return True, ""
            else:
                return False, "Session not found"
        except Exception as e:
            error_msg = f"Failed to delete session: {str(e)}"
            logging.error(f"[FreeChatSessionService] {error_msg}")
            return False, error_msg

    @classmethod
    def delete_by_user(cls, user_id: str) -> int:
        """
        删除用户的所有会话

        Args:
            user_id: 用户 ID

        Returns:
            删除的会话数量
        """
        try:
            # 先获取所有会话ID
            sessions = cls.list_by_user(user_id)
            session_ids = [s.id for s in sessions]
            
            # 删除所有消息
            from api.db.services.free_chat_message_service import FreeChatMessageService
            for session_id in session_ids:
                FreeChatMessageService.delete_by_session(session_id)
            
            # 删除所有会话
            num = cls.model.delete().where(cls.model.user_id == user_id).execute()
            logging.info(f"[FreeChatSessionService] Deleted {num} sessions for user {user_id}")
            return num
        except Exception as e:
            logging.error(f"[FreeChatSessionService] Error deleting sessions for user {user_id}: {e}")
            return 0
