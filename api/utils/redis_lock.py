"""
Redis分布式锁实现
用于防止并发更新导致的数据不一致
"""

import time
import logging
from contextlib import contextmanager
from typing import Optional
from rag.utils.redis_conn import REDIS_CONN


class RedisLock:
    """Redis分布式锁"""

    def __init__(self, lock_name: str, timeout: int = 10, retry_interval: float = 0.001):
        """
        初始化Redis锁

        Args:
            lock_name: 锁名称
            timeout: 锁超时时间（秒）
            retry_interval: 重试间隔（秒）
        """
        self.lock_name = f"lock:{lock_name}"
        self.timeout = timeout
        self.retry_interval = retry_interval
        self.identifier = None

    def acquire(self) -> bool:
        """
        获取锁

        Returns:
            bool: 是否成功获取锁
        """
        end_time = time.time() + self.timeout

        while time.time() < end_time:
            # 使用SET NX EX原子操作
            identifier = str(time.time())
            if REDIS_CONN.set(self.lock_name, identifier, nx=True, ex=self.timeout):
                self.identifier = identifier
                logging.debug(f"[RedisLock] Acquired lock: {self.lock_name}")
                return True
            time.sleep(self.retry_interval)

        logging.warning(f"[RedisLock] Failed to acquire lock: {self.lock_name}")
        return False

    def release(self):
        """释放锁"""
        if self.identifier:
            # Lua脚本保证原子性：只有持有锁的客户端才能释放
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            try:
                REDIS_CONN.eval(lua_script, 1, self.lock_name, self.identifier)
                logging.debug(f"[RedisLock] Released lock: {self.lock_name}")
            except Exception as e:
                logging.error(f"[RedisLock] Failed to release lock {self.lock_name}: {e}")
            finally:
                self.identifier = None


@contextmanager
def redis_lock(lock_name: str, timeout: int = 10):
    """
    分布式锁上下文管理器

    Args:
        lock_name: 锁名称
        timeout: 锁超时时间（秒）

    Raises:
        TimeoutError: 获取锁超时

    Example:
        with redis_lock("freechat_settings:user_123", timeout=5):
            # 执行需要加锁的操作
            pass
    """
    lock = RedisLock(lock_name, timeout)
    try:
        acquired = lock.acquire()
        if not acquired:
            raise TimeoutError(f"Failed to acquire lock: {lock_name}")
        yield lock
    finally:
        lock.release()
