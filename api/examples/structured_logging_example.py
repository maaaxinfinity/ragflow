"""
结构化日志使用示例
展示如何使用结构化日志系统
"""

from flask import Flask, jsonify, request
from api.utils.logging_config import (
    setup_structured_logging,
    log_info,
    log_warning,
    log_error,
    log_debug,
    log_performance,
    SensitiveDataFilter,
)
from api.exceptions.free_chat_exceptions import FreeChatError, InvalidSettingsError
import logging
import time

# ==================== 示例 1: 基础配置 ====================

app = Flask(__name__)

# 配置结构化日志
setup_structured_logging(app, log_level='INFO')

# 添加敏感数据过滤器
sensitive_filter = SensitiveDataFilter()
for handler in app.logger.handlers:
    handler.addFilter(sensitive_filter)


# ==================== 示例 2: 基础日志记录 ====================

@app.route('/api/example/basic')
def basic_logging_example():
    """基础日志记录示例"""
    
    # INFO 日志
    log_info(
        'User accessed basic logging example',
        user_id='user_123',
        endpoint='/api/example/basic'
    )
    
    # WARNING 日志
    log_warning(
        'Deprecated API endpoint used',
        endpoint='/api/example/basic',
        new_endpoint='/api/v2/example/basic'
    )
    
    # DEBUG 日志（仅在 DEBUG 级别时输出）
    log_debug(
        'Request details',
        headers=dict(request.headers),
        args=dict(request.args)
    )
    
    return jsonify({'message': 'Check logs for examples'})


# ==================== 示例 3: 错误日志记录 ====================

@app.route('/api/example/error')
def error_logging_example():
    """错误日志记录示例"""
    try:
        # 模拟错误
        raise InvalidSettingsError('Invalid user_id parameter')
    except FreeChatError as e:
        # 记录业务错误
        log_error(
            f'FreeChat error: {e.message}',
            error_code=e.error_code,
            status_code=e.status_code,
            user_id='user_123'
        )
        return jsonify(e.to_dict()), e.status_code
    except Exception as e:
        # 记录未预期的错误（包含堆栈）
        log_error(
            'Unexpected error occurred',
            exc_info=True,  # 包含完整堆栈信息
            endpoint='/api/example/error'
        )
        return jsonify({'error': 'Internal server error'}), 500


# ==================== 示例 4: 性能监控 ====================

@log_performance('save_user_settings')
def save_user_settings(user_id: str, settings: dict):
    """
    保存用户设置（带性能监控）
    
    自动记录执行时间和状态
    """
    # 模拟数据库操作
    time.sleep(0.1)
    
    # 添加额外日志
    log_info(
        'Settings saved successfully',
        user_id=user_id,
        settings_count=len(settings)
    )
    
    return True


@app.route('/api/example/performance')
def performance_example():
    """性能监控示例"""
    user_id = 'user_123'
    settings = {'dialog_id': 'abc', 'temperature': 0.7}
    
    # 调用带性能监控的函数
    result = save_user_settings(user_id, settings)
    
    return jsonify({'success': result})


# ==================== 示例 5: 敏感数据过滤 ====================

@app.route('/api/example/sensitive')
def sensitive_data_example():
    """敏感数据过滤示例"""
    
    # 记录包含敏感数据的日志
    log_info(
        'User authentication attempt',
        user_id='user_123',
        password='secret123',  # ⚠️ 会被自动隐藏为 ***MASKED***
        api_key='sk-1234567890',  # ⚠️ 会被自动隐藏
        email='user@example.com',  # ✅ 不会被隐藏
    )
    
    return jsonify({'message': 'Check logs - sensitive data should be masked'})


# ==================== 示例 6: 结构化日志输出 ====================

"""
日志输出格式示例（JSON）:

{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "INFO",
  "logger": "api.apps.free_chat_app",
  "message": "User login successful",
  "module": "free_chat_app",
  "function": "login",
  "line": 156,
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "user_123",
  "path": "/api/free_chat/login",
  "method": "POST",
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "extra_field_1": "value1",
  "extra_field_2": "value2"
}

错误日志示例:

{
  "timestamp": "2025-01-15T10:30:50.456Z",
  "level": "ERROR",
  "logger": "api.apps.free_chat_app",
  "message": "Failed to save settings",
  "module": "free_chat_app",
  "function": "save_user_settings",
  "line": 180,
  "request_id": "b2c3d4e5-f6g7-8901-bcde-fg2345678901",
  "user_id": "user_123",
  "path": "/api/free_chat/settings",
  "method": "POST",
  "ip": "192.168.1.100",
  "error_code": "DATABASE_ERROR",
  "exception": {
    "type": "DatabaseError",
    "message": "Failed to connect to database",
    "traceback": "Traceback (most recent call last):\\n  File..."
  }
}
"""


# ==================== 示例 7: 与 Flask-Login 集成 ====================

from flask_login import current_user

@app.before_request
def log_request_start():
    """记录请求开始"""
    log_info(
        'Request started',
        path=request.path,
        method=request.method,
        user_authenticated=current_user.is_authenticated if hasattr(current_user, 'is_authenticated') else False
    )


@app.after_request
def log_request_end(response):
    """记录请求结束"""
    log_info(
        'Request completed',
        path=request.path,
        status_code=response.status_code,
        content_length=response.content_length
    )
    return response


# ==================== 示例 8: 复杂操作的日志追踪 ====================

@app.route('/api/example/complex')
@log_performance('complex_operation')
def complex_operation_example():
    """复杂操作的日志追踪示例"""
    user_id = 'user_123'
    
    # 步骤 1: 验证用户
    log_info('Step 1: Validating user', user_id=user_id, step=1)
    time.sleep(0.05)
    
    # 步骤 2: 加载设置
    log_info('Step 2: Loading settings', user_id=user_id, step=2)
    time.sleep(0.05)
    
    # 步骤 3: 更新设置
    log_info('Step 3: Updating settings', user_id=user_id, step=3)
    time.sleep(0.05)
    
    # 步骤 4: 保存到数据库
    log_info('Step 4: Saving to database', user_id=user_id, step=4)
    time.sleep(0.05)
    
    log_info(
        'Complex operation completed successfully',
        user_id=user_id,
        total_steps=4
    )
    
    return jsonify({'success': True})


# ==================== 示例 9: 日志查询和分析 ====================

"""
使用 jq 查询日志（假设日志输出到 app.log）:

# 查找所有错误日志
cat app.log | jq 'select(.level == "ERROR")'

# 查找特定用户的日志
cat app.log | jq 'select(.user_id == "user_123")'

# 查找慢请求（超过 1000ms）
cat app.log | jq 'select(.duration_ms > 1000)'

# 统计每个端点的请求数
cat app.log | jq -s 'group_by(.path) | map({path: .[0].path, count: length})'

# 查找特定请求 ID 的所有日志
cat app.log | jq 'select(.request_id == "a1b2c3d4-e5f6-7890-abcd-ef1234567890")'

使用 ELK Stack 分析:

1. Filebeat 收集日志文件
2. Logstash 解析 JSON 格式
3. Elasticsearch 存储和索引
4. Kibana 可视化和查询

Kibana 查询示例:
- level: "ERROR" AND user_id: "user_123"
- duration_ms: >1000
- path: "/api/free_chat/*"
"""


# ==================== 示例 10: 在 FreeChat 中的实际使用 ====================

@app.route('/api/free_chat/settings', methods=['POST'])
@log_performance('save_freechat_settings')
def save_freechat_settings_example():
    """FreeChat 设置保存的实际使用示例"""
    try:
        user_id = request.json.get('user_id')
        
        # 记录开始
        log_info(
            'Saving FreeChat settings',
            user_id=user_id,
            session_count=len(request.json.get('sessions', []))
        )
        
        # 验证参数
        if not user_id:
            log_warning('Missing user_id parameter')
            raise InvalidSettingsError('user_id is required')
        
        # 保存设置（模拟）
        time.sleep(0.1)
        
        # 记录成功
        log_info(
            'Settings saved successfully',
            user_id=user_id,
            settings_size_bytes=len(str(request.json))
        )
        
        return jsonify({'code': 0, 'message': 'Success'})
        
    except FreeChatError as e:
        # 记录业务错误
        log_error(
            f'FreeChat error: {e.message}',
            error_code=e.error_code,
            user_id=user_id
        )
        return jsonify(e.to_dict()), e.status_code
        
    except Exception as e:
        # 记录未预期错误
        log_error(
            'Unexpected error while saving settings',
            exc_info=True,
            user_id=user_id
        )
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
