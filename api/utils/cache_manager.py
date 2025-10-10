"""
FreeChat 缓存管理器
实现多级缓存策略和缓存预热

性能目标:
- 缓存命中率 >80%
- API 响应时间减少 30%
- 支持缓存预热
- 智能缓存失效
"""

import json
import logging
from typing import Any, Callable, Optional, Tuple
from datetime import datetime, timedelta
from functools import wraps
from rag.utils.redis_conn import REDIS_CONN


# ==================== 缓存键前缀 ====================

class CacheKeys:
    """缓存键命名空间"""
    SETTINGS = "freechat:settings:"      # 用户设置
    SESSIONS = "freechat:sessions:"      # 会话列表
    DIALOGS = "freechat:dialogs:"        # 对话列表（按租户）
    USER_INFO = "freechat:userinfo:"     # 用户信息
    TENANT_INFO = "freechat:tenant:"     # 租户信息


# ==================== 缓存配置 ====================

class CacheTTL:
    """缓存过期时间（秒）"""
    SETTINGS = 5 * 60          # 5分钟（频繁更新）
    SESSIONS = 7 * 24 * 60 * 60  # 7天（需要持久化）
    DIALOGS = 30 * 60          # 30分钟（较少变化）
    USER_INFO = 60 * 60        # 1小时
    TENANT_INFO = 60 * 60      # 1小时


# ==================== 缓存管理器 ====================

class CacheManager:
    """
    统一缓存管理器
    
    特性:
    - 多级缓存（内存 + Redis）
    - 自动序列化/反序列化
    - 统一的键命名规范
    - 批量操作支持
    - 缓存预热
    """
    
    def __init__(self):
        self.redis = REDIS_CONN
        # 内存缓存（L1）- 临时存储热数据
        self._memory_cache = {}
        self._memory_cache_ttl = {}
    
    # ==================== 基础操作 ====================
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        获取缓存值
        L1: 内存缓存（超快）
        L2: Redis缓存（快）
        """
        # L1: 检查内存缓存
        if key in self._memory_cache:
            if key in self._memory_cache_ttl:
                if datetime.now() < self._memory_cache_ttl[key]:
                    logging.debug(f"[Cache] L1 hit: {key}")
                    return self._memory_cache[key]
                else:
                    # 过期，删除
                    del self._memory_cache[key]
                    del self._memory_cache_ttl[key]
        
        # L2: 检查 Redis 缓存
        try:
            data = self.redis.get(key)
            if data:
                value = json.loads(data) if isinstance(data, str) else data
                # 写入 L1 缓存
                self._set_memory_cache(key, value, ttl=60)  # L1 缓存 1 分钟
                logging.debug(f"[Cache] L2 hit: {key}")
                return value
        except Exception as e:
            logging.warning(f"[Cache] Redis get failed for {key}: {e}")
        
        logging.debug(f"[Cache] Miss: {key}")
        return default
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        设置缓存值
        同时写入 L1（内存）和 L2（Redis）
        """
        try:
            # L2: 写入 Redis
            self.redis.set_obj(key, value, ttl)
            
            # L1: 写入内存缓存
            self._set_memory_cache(key, value, min(ttl, 300))  # L1 最多缓存5分钟
            
            logging.debug(f"[Cache] Set: {key}, TTL: {ttl}s")
            return True
        except Exception as e:
            logging.error(f"[Cache] Set failed for {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        try:
            # 删除 L1
            if key in self._memory_cache:
                del self._memory_cache[key]
            if key in self._memory_cache_ttl:
                del self._memory_cache_ttl[key]
            
            # 删除 L2
            self.redis.delete(key)
            logging.debug(f"[Cache] Deleted: {key}")
            return True
        except Exception as e:
            logging.error(f"[Cache] Delete failed for {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """检查缓存是否存在"""
        if key in self._memory_cache:
            if key in self._memory_cache_ttl:
                if datetime.now() < self._memory_cache_ttl[key]:
                    return True
        
        try:
            return self.redis.exists(key)
        except Exception:
            return False
    
    # ==================== 高级操作 ====================
    
    def get_or_set(self, key: str, factory: Callable[[], Any], ttl: int = 300) -> Any:
        """
        获取缓存，如果不存在则调用工厂函数生成并缓存
        """
        value = self.get(key)
        if value is not None:
            return value
        
        # 缓存未命中，生成新值
        value = factory()
        if value is not None:
            self.set(key, value, ttl)
        return value
    
    def invalidate_pattern(self, pattern: str) -> int:
        """
        批量删除匹配模式的缓存
        返回删除的键数量
        """
        try:
            # 清理内存缓存
            keys_to_delete = [k for k in self._memory_cache.keys() if pattern in k]
            for key in keys_to_delete:
                if key in self._memory_cache:
                    del self._memory_cache[key]
                if key in self._memory_cache_ttl:
                    del self._memory_cache_ttl[key]
            
            # 清理 Redis 缓存
            cursor = 0
            count = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=f"{pattern}*", count=100)
                if keys:
                    self.redis.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
            
            logging.info(f"[Cache] Invalidated {count} keys matching: {pattern}")
            return count
        except Exception as e:
            logging.error(f"[Cache] Invalidate pattern failed for {pattern}: {e}")
            return 0
    
    def warmup(self, warmup_func: Callable[[], dict]) -> int:
        """
        缓存预热
        批量加载常用数据到缓存
        """
        try:
            data = warmup_func()
            count = 0
            for key, (value, ttl) in data.items():
                if self.set(key, value, ttl):
                    count += 1
            logging.info(f"[Cache] Warmed up {count} cache entries")
            return count
        except Exception as e:
            logging.error(f"[Cache] Warmup failed: {e}")
            return 0
    
    # ==================== 内部方法 ====================
    
    def _set_memory_cache(self, key: str, value: Any, ttl: int):
        """设置内存缓存"""
        self._memory_cache[key] = value
        self._memory_cache_ttl[key] = datetime.now() + timedelta(seconds=ttl)
    
    def clear_memory_cache(self):
        """清空内存缓存（仅用于测试或紧急情况）"""
        self._memory_cache.clear()
        self._memory_cache_ttl.clear()
        logging.info("[Cache] Memory cache cleared")


# ==================== 全局缓存实例 ====================

cache_manager = CacheManager()


# ==================== 装饰器 ====================

def cached(key_prefix: str, ttl: int = 300, key_func: Optional[Callable] = None):
    """
    缓存装饰器
    
    用法:
    @cached(key_prefix="freechat:settings", ttl=300)
    def get_user_settings(user_id: str):
        # 复杂的数据库查询
        return settings
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # 默认使用函数名和参数生成键
                args_str = "_".join(str(arg) for arg in args)
                kwargs_str = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
                cache_key = f"{key_prefix}:{func.__name__}:{args_str}:{kwargs_str}"
            
            # 尝试从缓存获取
            result = cache_manager.get(cache_key)
            if result is not None:
                logging.debug(f"[Cache] Hit for {func.__name__}")
                return result
            
            # 缓存未命中，执行函数
            result = func(*args, **kwargs)
            
            # 缓存结果
            if result is not None:
                cache_manager.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# ==================== FreeChat 专用缓存函数 ====================

class FreeChatCache:
    """FreeChat 缓存辅助类"""
    
    @staticmethod
    def get_settings(user_id: str) -> Optional[dict]:
        """获取用户设置缓存"""
        key = f"{CacheKeys.SETTINGS}{user_id}"
        return cache_manager.get(key)
    
    @staticmethod
    def set_settings(user_id: str, settings: dict) -> bool:
        """设置用户设置缓存"""
        key = f"{CacheKeys.SETTINGS}{user_id}"
        return cache_manager.set(key, settings, CacheTTL.SETTINGS)
    
    @staticmethod
    def get_sessions(user_id: str) -> Optional[list]:
        """获取会话列表缓存"""
        key = f"{CacheKeys.SESSIONS}{user_id}"
        return cache_manager.get(key)
    
    @staticmethod
    def set_sessions(user_id: str, sessions: list) -> bool:
        """设置会话列表缓存"""
        key = f"{CacheKeys.SESSIONS}{user_id}"
        return cache_manager.set(key, sessions, CacheTTL.SESSIONS)
    
    @staticmethod
    def invalidate_user(user_id: str) -> int:
        """清除用户所有缓存"""
        patterns = [
            f"{CacheKeys.SETTINGS}{user_id}",
            f"{CacheKeys.SESSIONS}{user_id}",
            f"{CacheKeys.USER_INFO}{user_id}",
        ]
        count = 0
        for pattern in patterns:
            cache_manager.delete(pattern)
            count += 1
        return count
    
    @staticmethod
    def warmup_tenant_dialogs(tenant_id: str, dialogs: list) -> bool:
        """预热租户对话列表"""
        key = f"{CacheKeys.DIALOGS}{tenant_id}"
        return cache_manager.set(key, dialogs, CacheTTL.DIALOGS)
