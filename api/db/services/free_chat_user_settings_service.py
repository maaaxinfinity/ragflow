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
from api.db.db_models import DB, FreeChatUserSettings
from api.db.services.common_service import CommonService


class FreeChatUserSettingsService(CommonService):
    model = FreeChatUserSettings

    @classmethod
    @DB.connection_context()
    def get_by_user_id(cls, user_id):
        """Get free chat settings by user ID"""
        try:
            setting = cls.model.get(cls.model.user_id == user_id)
            return True, setting
        except Exception:
            return False, None

    @classmethod
    @DB.connection_context()
    def upsert(cls, user_id, **kwargs):
        """Insert or update free chat settings"""
        try:
            # Check if exists
            exists, setting = cls.get_by_user_id(user_id)
            if exists:
                # Update
                kwargs['user_id'] = user_id
                cls.update_by_id(user_id, kwargs)
                return True, cls.model.get(cls.model.user_id == user_id)
            else:
                # Insert
                kwargs['user_id'] = user_id
                setting = cls.save(**kwargs)
                return True, setting
        except Exception as e:
            return False, str(e)

    @classmethod
    @DB.connection_context()
    def delete_by_user_id(cls, user_id):
        """Delete free chat settings by user ID"""
        try:
            num = cls.model.delete().where(cls.model.user_id == user_id).execute()
            return num > 0
        except Exception:
            return False
