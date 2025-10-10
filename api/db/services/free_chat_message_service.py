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
FreeChat Message 服务层 - SQL 作为唯一可信数据源
管理消息的 CRUD 操作
"""

import logging
from typing import List, Optional, Tuple
from api.db.db_models import FreeChatMessage
from api.db.services.common_service import CommonService


class FreeChatMessageService(CommonService):
    model = FreeChatMessage

    @classmethod
    def get_by_id(cls, message_id: str) -> Tuple[bool, Optional[FreeChatMessage]]:
        """
        根据 message_id 查询消息

        Args:
            message_id: 消息 ID

        Returns:
            (exists, message)
        """
        try:
            message = cls.model.get(cls.model.id == message_id)
            return True, message
        except Exception:
            return False, None

    @classmethod
    def list_by_session(cls, session_id: str, limit: Optional[int] = None, 
                       offset: int = 0) -> List[FreeChatMessage]:
        """
        查询会话的所有消息（按序号排序）

        Args:
            session_id: 会话 ID
            limit: 限制返回数量（用于分页）
            offset: 偏移量（用于分页）

        Returns:
            消息列表
        """
        try:
            query = cls.model.select().where(
                cls.model.session_id == session_id
            ).order_by(cls.model.seq.asc())
            
            if offset > 0:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            
            return list(query)
        except Exception as e:
            logging.error(f"[FreeChatMessageService] Error listing messages for session {session_id}: {e}")
            return []

    @classmethod
    def count_by_session(cls, session_id: str) -> int:
        """
        统计会话的消息数量

        Args:
            session_id: 会话 ID

        Returns:
            消息数量
        """
        try:
            return cls.model.select().where(cls.model.session_id == session_id).count()
        except Exception as e:
            logging.error(f"[FreeChatMessageService] Error counting messages for session {session_id}: {e}")
            return 0

    @classmethod
    def get_next_seq(cls, session_id: str) -> int:
        """
        获取会话的下一个序号

        Args:
            session_id: 会话 ID

        Returns:
            下一个序号
        """
        try:
            result = cls.model.select(
                cls.model.seq
            ).where(
                cls.model.session_id == session_id
            ).order_by(
                cls.model.seq.desc()
            ).first()
            
            if result:
                return result.seq + 1
            else:
                return 0
        except Exception as e:
            logging.error(f"[FreeChatMessageService] Error getting next seq for session {session_id}: {e}")
            return 0

    @classmethod
    def create_message(cls, message_id: str, session_id: str, role: str, 
                      content: str, seq: int, created_at: int,
                      reference: Optional[list] = None) -> Tuple[bool, str]:
        """
        创建新消息

        Args:
            message_id: 消息 ID (UUID)
            session_id: 会话 ID
            role: 角色 (user/assistant)
            content: 消息内容
            seq: 序号
            created_at: 创建时间戳 (ms)
            reference: AI 响应的引用

        Returns:
            (success, error_message)
        """
        try:
            cls.save(
                id=message_id,
                session_id=session_id,
                role=role,
                content=content,
                seq=seq,
                created_at=created_at,
                reference=reference or []
            )
            logging.info(f"[FreeChatMessageService] Created message {message_id} in session {session_id}")
            return True, ""
        except Exception as e:
            error_msg = f"Failed to create message: {str(e)}"
            logging.error(f"[FreeChatMessageService] {error_msg}")
            return False, error_msg

    @classmethod
    def batch_create_messages(cls, messages: List[dict]) -> Tuple[bool, str]:
        """
        批量创建消息

        Args:
            messages: 消息列表，每个消息包含: id, session_id, role, content, seq, created_at, reference

        Returns:
            (success, error_message)
        """
        try:
            if not messages:
                return True, ""
            
            cls.model.insert_many(messages).execute()
            logging.info(f"[FreeChatMessageService] Batch created {len(messages)} messages")
            return True, ""
        except Exception as e:
            error_msg = f"Failed to batch create messages: {str(e)}"
            logging.error(f"[FreeChatMessageService] {error_msg}")
            return False, error_msg

    @classmethod
    def update_message(cls, message_id: str, **kwargs) -> Tuple[bool, str]:
        """
        更新消息

        Args:
            message_id: 消息 ID
            **kwargs: 要更新的字段 (content, reference等)

        Returns:
            (success, error_message)
        """
        try:
            num = cls.model.update(**kwargs).where(cls.model.id == message_id).execute()
            if num > 0:
                logging.info(f"[FreeChatMessageService] Updated message {message_id}")
                return True, ""
            else:
                return False, "Message not found"
        except Exception as e:
            error_msg = f"Failed to update message: {str(e)}"
            logging.error(f"[FreeChatMessageService] {error_msg}")
            return False, error_msg

    @classmethod
    def delete_message(cls, message_id: str) -> Tuple[bool, str]:
        """
        删除单条消息

        Args:
            message_id: 消息 ID

        Returns:
            (success, error_message)
        """
        try:
            num = cls.model.delete().where(cls.model.id == message_id).execute()
            if num > 0:
                logging.info(f"[FreeChatMessageService] Deleted message {message_id}")
                return True, ""
            else:
                return False, "Message not found"
        except Exception as e:
            error_msg = f"Failed to delete message: {str(e)}"
            logging.error(f"[FreeChatMessageService] {error_msg}")
            return False, error_msg

    @classmethod
    def delete_by_session(cls, session_id: str) -> int:
        """
        删除会话的所有消息

        Args:
            session_id: 会话 ID

        Returns:
            删除的消息数量
        """
        try:
            num = cls.model.delete().where(cls.model.session_id == session_id).execute()
            logging.info(f"[FreeChatMessageService] Deleted {num} messages for session {session_id}")
            return num
        except Exception as e:
            logging.error(f"[FreeChatMessageService] Error deleting messages for session {session_id}: {e}")
            return 0

    @classmethod
    def delete_after_seq(cls, session_id: str, seq: int) -> int:
        """
        删除会话中指定序号之后的所有消息（用于重新生成）

        Args:
            session_id: 会话 ID
            seq: 序号

        Returns:
            删除的消息数量
        """
        try:
            num = cls.model.delete().where(
                (cls.model.session_id == session_id) & (cls.model.seq > seq)
            ).execute()
            logging.info(f"[FreeChatMessageService] Deleted {num} messages after seq {seq} in session {session_id}")
            return num
        except Exception as e:
            logging.error(f"[FreeChatMessageService] Error deleting messages after seq: {e}")
            return 0
