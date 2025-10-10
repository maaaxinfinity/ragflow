"""
FreeChat自定义异常体系
提供细粒度的错误处理
"""


class FreeChatError(Exception):
    """FreeChat基础异常"""

    status_code = 500
    error_code = "FREECHAT_ERROR"

    def __init__(
        self,
        message: str,
        status_code: int = None,
        error_code: str = None,
        payload: dict = None,
    ):
        super().__init__(message)
        self.message = message
        if status_code:
            self.status_code = status_code
        if error_code:
            self.error_code = error_code
        self.payload = payload or {}

    def to_dict(self):
        """转换为字典格式"""
        return {
            "code": self.status_code,
            "error_code": self.error_code,
            "message": self.message,
            **self.payload,
        }


class SettingsNotFoundError(FreeChatError):
    """设置未找到异常"""

    status_code = 404
    error_code = "SETTINGS_NOT_FOUND"


class UnauthorizedAccessError(FreeChatError):
    """未授权访问异常"""

    status_code = 403
    error_code = "UNAUTHORIZED_ACCESS"


class InvalidSettingsError(FreeChatError):
    """无效设置异常"""

    status_code = 400
    error_code = "INVALID_SETTINGS"


class DatabaseError(FreeChatError):
    """数据库错误"""

    status_code = 500
    error_code = "DATABASE_ERROR"


class CacheError(FreeChatError):
    """缓存错误"""

    status_code = 500
    error_code = "CACHE_ERROR"


class LockTimeoutError(FreeChatError):
    """锁超时错误"""

    status_code = 409
    error_code = "LOCK_TIMEOUT"
