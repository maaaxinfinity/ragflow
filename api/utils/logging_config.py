"""
结构化日志配置
提供统一的日志格式，便于追踪和分析
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from flask import request, g, has_request_context


class StructuredFormatter(logging.Formatter):
    """
    结构化日志格式化器
    输出 JSON 格式的日志，包含时间戳、级别、消息、上下文等信息
    """

    def format(self, record: logging.LogRecord) -> str:
        """
        格式化日志记录为 JSON

        Args:
            record: 日志记录

        Returns:
            JSON 格式的日志字符串
        """
        # 基础日志数据
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # 添加请求上下文（如果在请求中）
        if has_request_context():
            try:
                log_data.update({
                    'request_id': getattr(g, 'request_id', None),
                    'user_id': getattr(g, 'user_id', None),
                    'path': request.path,
                    'method': request.method,
                    'ip': request.remote_addr,
                    'user_agent': request.headers.get('User-Agent', ''),
                })
            except RuntimeError:
                # 在某些情况下访问 request 可能失败
                pass

        # 添加额外字段（通过 extra 参数传递）
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)

        # 添加异常信息
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info),
            }

        return json.dumps(log_data, ensure_ascii=False)


class RequestIdMiddleware:
    """
    请求 ID 中间件
    为每个请求生成唯一 ID，用于日志追踪
    """

    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        # 生成或获取请求 ID
        request_id = environ.get('HTTP_X_REQUEST_ID', str(uuid.uuid4()))
        
        # 保存到环境变量
        environ['request_id'] = request_id
        
        # 添加到响应头
        def custom_start_response(status, headers, exc_info=None):
            headers.append(('X-Request-ID', request_id))
            return start_response(status, headers, exc_info)
        
        return self.app(environ, custom_start_response)


def setup_structured_logging(app, log_level: str = 'INFO'):
    """
    配置结构化日志

    Args:
        app: Flask 应用实例
        log_level: 日志级别（DEBUG, INFO, WARNING, ERROR, CRITICAL）
    """
    # 创建 handler
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())

    # 设置应用日志
    app.logger.handlers.clear()
    app.logger.addHandler(handler)
    app.logger.setLevel(getattr(logging, log_level.upper()))

    # 设置根日志
    logging.root.handlers.clear()
    logging.root.addHandler(handler)
    logging.root.setLevel(getattr(logging, log_level.upper()))

    # 添加请求 ID 中间件
    app.wsgi_app = RequestIdMiddleware(app.wsgi_app)

    # 添加 before_request 钩子，设置请求上下文
    @app.before_request
    def set_request_context():
        """设置请求上下文信息"""
        # 从环境变量获取请求 ID
        g.request_id = request.environ.get('request_id')
        
        # 尝试获取用户 ID（如果已认证）
        try:
            from flask_login import current_user
            if current_user and current_user.is_authenticated:
                g.user_id = current_user.id
            else:
                g.user_id = None
        except Exception:
            g.user_id = None

    # 添加 after_request 钩子，记录请求日志
    @app.after_request
    def log_request(response):
        """记录请求日志"""
        # 跳过静态文件请求
        if request.path.startswith('/static/'):
            return response

        log_data(
            'request_completed',
            level='INFO',
            status_code=response.status_code,
            duration_ms=0,  # 可以添加计时逻辑
        )
        return response


def log_data(
    message: str,
    level: str = 'INFO',
    **extra_fields: Any
):
    """
    记录结构化日志

    Args:
        message: 日志消息
        level: 日志级别
        **extra_fields: 额外字段

    Example:
        log_data(
            'User login successful',
            level='INFO',
            user_id='user_123',
            ip_address='192.168.1.1'
        )
    """
    logger = logging.getLogger(__name__)
    log_method = getattr(logger, level.lower(), logger.info)
    
    # 创建 LogRecord 并添加额外字段
    record = logging.LogRecord(
        name=logger.name,
        level=getattr(logging, level.upper()),
        pathname='',
        lineno=0,
        msg=message,
        args=(),
        exc_info=None,
    )
    record.extra_fields = extra_fields
    
    # 记录日志
    for handler in logger.handlers:
        handler.emit(record)


def log_info(message: str, **extra_fields: Any):
    """记录 INFO 级别日志"""
    log_data(message, level='INFO', **extra_fields)


def log_warning(message: str, **extra_fields: Any):
    """记录 WARNING 级别日志"""
    log_data(message, level='WARNING', **extra_fields)


def log_error(message: str, exc_info: bool = False, **extra_fields: Any):
    """
    记录 ERROR 级别日志

    Args:
        message: 日志消息
        exc_info: 是否包含异常信息
        **extra_fields: 额外字段
    """
    logger = logging.getLogger(__name__)
    logger.error(message, exc_info=exc_info, extra={'extra_fields': extra_fields})


def log_debug(message: str, **extra_fields: Any):
    """记录 DEBUG 级别日志"""
    log_data(message, level='DEBUG', **extra_fields)


# ==================== 性能监控装饰器 ====================

import time
from functools import wraps


def log_performance(operation_name: str):
    """
    性能监控装饰器
    记录函数执行时间

    Args:
        operation_name: 操作名称

    Example:
        @log_performance('save_settings')
        def save_user_settings(user_id, settings):
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                log_info(
                    f'{operation_name} completed',
                    operation=operation_name,
                    duration_ms=round(duration_ms, 2),
                    status='success'
                )
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                log_error(
                    f'{operation_name} failed',
                    exc_info=True,
                    operation=operation_name,
                    duration_ms=round(duration_ms, 2),
                    status='error',
                    error_type=type(e).__name__,
                    error_message=str(e)
                )
                raise
        return wrapper
    return decorator


# ==================== 日志过滤器 ====================

class SensitiveDataFilter(logging.Filter):
    """
    敏感数据过滤器
    自动隐藏密码、token等敏感信息
    """
    
    SENSITIVE_KEYS = {
        'password', 'token', 'api_key', 'secret', 
        'auth', 'credential', 'private_key'
    }
    
    def filter(self, record: logging.LogRecord) -> bool:
        """
        过滤敏感数据

        Args:
            record: 日志记录

        Returns:
            是否保留该日志
        """
        if hasattr(record, 'extra_fields') and isinstance(record.extra_fields, dict):
            record.extra_fields = self._mask_sensitive_data(record.extra_fields)
        return True
    
    def _mask_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        隐藏敏感数据

        Args:
            data: 数据字典

        Returns:
            处理后的数据字典
        """
        masked_data = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in self.SENSITIVE_KEYS):
                masked_data[key] = '***MASKED***'
            elif isinstance(value, dict):
                masked_data[key] = self._mask_sensitive_data(value)
            else:
                masked_data[key] = value
        return masked_data
