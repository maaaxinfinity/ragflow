# 为 FreeChat 添加 API key 或登录认证的混合装饰器
from functools import wraps
from flask import request
from flask_login import current_user
from api.db.db_models import APIToken
from api.utils.api_utils import get_data_error_result
from api import settings

def api_key_or_login_required(func):
    """
    支持两种认证方式：
    1. Authorization: Bearer {beta_token} - 用于第三方嵌入
    2. Flask session - 用于已登录用户
    """
    @wraps(func)
    def decorated_function(*args, **kwargs):
        # 方式 1: 检查 API key (beta token)
        authorization_str = request.headers.get("Authorization")
        if authorization_str:
            parts = authorization_str.split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                beta_token = parts[1]
                tokens = APIToken.query(beta=beta_token)
                if tokens:
                    # 认证成功，注入 tenant_id
                    kwargs["tenant_id"] = tokens[0].tenant_id
                    kwargs["auth_method"] = "api_key"
                    return func(*args, **kwargs)

        # 方式 2: 检查登录状态
        if current_user and current_user.is_authenticated:
            kwargs["auth_method"] = "session"
            return func(*args, **kwargs)

        # 两种方式都失败
        return get_data_error_result(
            message="Authentication required. Please login or provide valid API key.",
            code=settings.RetCode.AUTHENTICATION_ERROR
        )

    return decorated_function
