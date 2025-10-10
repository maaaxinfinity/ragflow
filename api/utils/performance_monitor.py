"""
FreeChat 性能监控系统
收集和报告性能指标

监控指标:
- API 响应时间
- 数据库查询时间
- 缓存命中率
- 错误率
"""

import time
import logging
from typing import Dict, List, Optional, Callable
from functools import wraps
from datetime import datetime, timedelta
from collections import defaultdict, deque
from api.utils.cache_manager import cache_manager


# ==================== 性能指标收集器 ====================

class PerformanceMetrics:
    """性能指标收集器"""
    
    def __init__(self, max_samples: int = 1000):
        self.max_samples = max_samples
        
        # 响应时间记录（最近 N 个样本）
        self.response_times = deque(maxlen=max_samples)
        
        # 按端点分组的响应时间
        self.endpoint_metrics = defaultdict(lambda: deque(maxlen=100))
        
        # 缓存指标
        self.cache_hits = 0
        self.cache_misses = 0
        
        # 错误计数
        self.errors = defaultdict(int)
        
        # 数据库查询时间
        self.db_query_times = deque(maxlen=max_samples)
        
        # 开始时间
        self.start_time = datetime.now()
    
    def record_response_time(self, endpoint: str, duration: float):
        """记录API响应时间"""
        self.response_times.append({
            'endpoint': endpoint,
            'duration': duration,
            'timestamp': datetime.now()
        })
        self.endpoint_metrics[endpoint].append(duration)
    
    def record_cache_hit(self):
        """记录缓存命中"""
        self.cache_hits += 1
    
    def record_cache_miss(self):
        """记录缓存未命中"""
        self.cache_misses += 1
    
    def record_error(self, error_type: str):
        """记录错误"""
        self.errors[error_type] += 1
    
    def record_db_query(self, duration: float):
        """记录数据库查询时间"""
        self.db_query_times.append(duration)
    
    def get_cache_hit_rate(self) -> float:
        """获取缓存命中率"""
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return (self.cache_hits / total) * 100
    
    def get_average_response_time(self, endpoint: Optional[str] = None) -> float:
        """获取平均响应时间"""
        if endpoint:
            times = self.endpoint_metrics.get(endpoint, [])
        else:
            times = [r['duration'] for r in self.response_times]
        
        if not times:
            return 0.0
        return sum(times) / len(times)
    
    def get_p95_response_time(self, endpoint: Optional[str] = None) -> float:
        """获取 P95 响应时间"""
        if endpoint:
            times = list(self.endpoint_metrics.get(endpoint, []))
        else:
            times = [r['duration'] for r in self.response_times]
        
        if not times:
            return 0.0
        
        times.sort()
        index = int(len(times) * 0.95)
        return times[index] if index < len(times) else times[-1]
    
    def get_summary(self) -> Dict:
        """获取性能摘要"""
        uptime = (datetime.now() - self.start_time).total_seconds()
        
        return {
            'uptime_seconds': uptime,
            'total_requests': len(self.response_times),
            'avg_response_time_ms': self.get_average_response_time() * 1000,
            'p95_response_time_ms': self.get_p95_response_time() * 1000,
            'cache_hit_rate': self.get_cache_hit_rate(),
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'total_errors': sum(self.errors.values()),
            'errors_by_type': dict(self.errors),
            'avg_db_query_ms': (sum(self.db_query_times) / len(self.db_query_times) * 1000) 
                               if self.db_query_times else 0,
            'endpoints': {
                endpoint: {
                    'avg_ms': self.get_average_response_time(endpoint) * 1000,
                    'p95_ms': self.get_p95_response_time(endpoint) * 1000,
                    'count': len(times)
                }
                for endpoint, times in self.endpoint_metrics.items()
            }
        }


# ==================== 全局指标收集器 ====================

performance_metrics = PerformanceMetrics()


# ==================== 装饰器 ====================

def monitor_performance(endpoint_name: str = None):
    """
    性能监控装饰器
    自动记录函数执行时间
    
    用法:
    @monitor_performance('get_user_settings')
    def get_user_settings(user_id):
        # 函数代码
        pass
    """
    def decorator(func: Callable):
        nonlocal endpoint_name
        if endpoint_name is None:
            endpoint_name = func.__name__
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            error_occurred = False
            
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                error_occurred = True
                performance_metrics.record_error(type(e).__name__)
                raise
            finally:
                duration = time.time() - start_time
                performance_metrics.record_response_time(endpoint_name, duration)
                
                # 记录日志
                status = 'ERROR' if error_occurred else 'OK'
                logging.info(f"[Performance] {endpoint_name}: {duration*1000:.2f}ms [{status}]")
        
        return wrapper
    return decorator


def monitor_db_query(func: Callable):
    """
    数据库查询监控装饰器
    
    用法:
    @monitor_db_query
    def query_database():
        # 查询代码
        pass
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            return func(*args, **kwargs)
        finally:
            duration = time.time() - start_time
            performance_metrics.record_db_query(duration)
            if duration > 0.1:  # 慢查询 >100ms
                logging.warning(f"[SlowQuery] {func.__name__}: {duration*1000:.2f}ms")
    
    return wrapper


# ==================== 性能报告 ====================

class PerformanceReporter:
    """性能报告生成器"""
    
    @staticmethod
    def generate_text_report() -> str:
        """生成文本格式报告"""
        summary = performance_metrics.get_summary()
        
        report = []
        report.append("=" * 60)
        report.append("FreeChat 性能监控报告")
        report.append("=" * 60)
        report.append(f"\n运行时间: {summary['uptime_seconds']:.0f} 秒")
        report.append(f"总请求数: {summary['total_requests']}")
        report.append(f"\n【响应时间】")
        report.append(f"  平均: {summary['avg_response_time_ms']:.2f} ms")
        report.append(f"  P95:  {summary['p95_response_time_ms']:.2f} ms")
        report.append(f"\n【缓存性能】")
        report.append(f"  命中率: {summary['cache_hit_rate']:.1f}%")
        report.append(f"  命中次数: {summary['cache_hits']}")
        report.append(f"  未命中次数: {summary['cache_misses']}")
        report.append(f"\n【数据库】")
        report.append(f"  平均查询时间: {summary['avg_db_query_ms']:.2f} ms")
        report.append(f"\n【错误】")
        report.append(f"  总错误数: {summary['total_errors']}")
        for error_type, count in summary['errors_by_type'].items():
            report.append(f"    {error_type}: {count}")
        
        if summary['endpoints']:
            report.append(f"\n【端点详情】")
            for endpoint, metrics in summary['endpoints'].items():
                report.append(f"  {endpoint}:")
                report.append(f"    请求数: {metrics['count']}")
                report.append(f"    平均: {metrics['avg_ms']:.2f} ms")
                report.append(f"    P95: {metrics['p95_ms']:.2f} ms")
        
        report.append("=" * 60)
        
        return "\n".join(report)
    
    @staticmethod
    def generate_json_report() -> Dict:
        """生成 JSON 格式报告"""
        return performance_metrics.get_summary()
    
    @staticmethod
    def check_health() -> Dict:
        """健康检查"""
        summary = performance_metrics.get_summary()
        
        health = {
            'status': 'healthy',
            'checks': {},
            'metrics': summary
        }
        
        # 检查响应时间
        if summary['avg_response_time_ms'] > 500:
            health['checks']['response_time'] = {
                'status': 'warning',
                'message': f"平均响应时间较高: {summary['avg_response_time_ms']:.2f}ms"
            }
        else:
            health['checks']['response_time'] = {
                'status': 'ok',
                'message': f"响应时间正常: {summary['avg_response_time_ms']:.2f}ms"
            }
        
        # 检查缓存命中率
        if summary['cache_hit_rate'] < 70:
            health['checks']['cache_hit_rate'] = {
                'status': 'warning',
                'message': f"缓存命中率较低: {summary['cache_hit_rate']:.1f}%"
            }
        else:
            health['checks']['cache_hit_rate'] = {
                'status': 'ok',
                'message': f"缓存命中率正常: {summary['cache_hit_rate']:.1f}%"
            }
        
        # 检查错误率
        if summary['total_requests'] > 0:
            error_rate = (summary['total_errors'] / summary['total_requests']) * 100
            if error_rate > 5:
                health['checks']['error_rate'] = {
                    'status': 'error',
                    'message': f"错误率过高: {error_rate:.2f}%"
                }
                health['status'] = 'unhealthy'
            elif error_rate > 1:
                health['checks']['error_rate'] = {
                    'status': 'warning',
                    'message': f"错误率偏高: {error_rate:.2f}%"
                }
            else:
                health['checks']['error_rate'] = {
                    'status': 'ok',
                    'message': f"错误率正常: {error_rate:.2f}%"
                }
        
        return health


# ==================== Flask 集成 ====================

def init_performance_monitoring(app):
    """
    初始化性能监控
    添加到 Flask app
    """
    
    @app.before_request
    def before_request():
        """请求开始时记录"""
        from flask import g
        g.start_time = time.time()
    
    @app.after_request
    def after_request(response):
        """请求结束时记录"""
        from flask import g, request
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            performance_metrics.record_response_time(request.endpoint or 'unknown', duration)
        return response
    
    # 性能报告端点
    @app.route('/api/performance/metrics')
    def get_performance_metrics():
        """获取性能指标"""
        from flask import jsonify
        return jsonify(PerformanceReporter.generate_json_report())
    
    @app.route('/api/performance/health')
    def get_health_check():
        """健康检查"""
        from flask import jsonify
        health = PerformanceReporter.check_health()
        status_code = 200 if health['status'] == 'healthy' else 503
        return jsonify(health), status_code
    
    logging.info("[Performance] Monitoring initialized")


if __name__ == "__main__":
    # 测试示例
    print("=== 性能监控测试 ===\n")
    
    # 模拟一些请求
    for i in range(10):
        performance_metrics.record_response_time('test_endpoint', 0.05 + i * 0.01)
        if i % 2 == 0:
            performance_metrics.record_cache_hit()
        else:
            performance_metrics.record_cache_miss()
    
    # 生成报告
    print(PerformanceReporter.generate_text_report())
    
    # 健康检查
    print("\n健康检查:")
    import json
    print(json.dumps(PerformanceReporter.check_health(), indent=2, ensure_ascii=False))
