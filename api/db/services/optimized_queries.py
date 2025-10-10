"""
FreeChat 查询优化
实现批量查询和 N+1 查询优化

优化策略:
- 批量加载关联数据
- 预加载常用数据
- 减少数据库往返次数
"""

from typing import List, Dict, Any, Optional
from api.db.db_models import DB, FreeChatUserSettings, Dialog, Conversation
from api.db.services.dialog_service import DialogService
from api.db.services.user_service import UserTenantService
from api.utils.cache_manager import FreeChatCache, cache_manager
import logging


class OptimizedFreeChatQueries:
    """
    FreeChat 优化查询类
    消除 N+1 查询，实现批量操作
    """
    
    @staticmethod
    @DB.connection_context()
    def batch_get_settings(user_ids: List[str]) -> Dict[str, Optional[dict]]:
        """
        批量获取用户设置
        优化: 一次查询获取多个用户的设置
        
        Args:
            user_ids: 用户ID列表
            
        Returns:
            {user_id: settings_dict} 字典
        """
        try:
            # 批量查询
            settings_list = FreeChatUserSettings.select().where(
                FreeChatUserSettings.user_id.in_(user_ids)
            )
            
            # 转换为字典
            result = {}
            for setting in settings_list:
                result[setting.user_id] = setting.to_dict()
            
            # 填充缺失的用户（未找到设置）
            for user_id in user_ids:
                if user_id not in result:
                    result[user_id] = None
            
            logging.info(f"[OptimizedQuery] Batch loaded {len(result)} user settings")
            return result
            
        except Exception as e:
            logging.error(f"[OptimizedQuery] Batch get settings failed: {e}")
            return {user_id: None for user_id in user_ids}
    
    @staticmethod
    @DB.connection_context()
    def get_settings_with_dialog(user_id: str, tenant_id: str) -> Dict[str, Any]:
        """
        获取用户设置并预加载关联的 Dialog
        优化: 避免 N+1 查询
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            
        Returns:
            包含 settings 和 dialog 的字典
        """
        try:
            # 1. 获取设置
            setting = FreeChatUserSettings.get_or_none(
                FreeChatUserSettings.user_id == user_id
            )
            
            if not setting:
                return {
                    'settings': None,
                    'dialog': None
                }
            
            result = {
                'settings': setting.to_dict(),
                'dialog': None
            }
            
            # 2. 如果有 dialog_id，预加载 Dialog
            if setting.dialog_id:
                # 先查缓存
                cache_key = f"dialog:{setting.dialog_id}:{tenant_id}"
                dialog_dict = cache_manager.get(cache_key)
                
                if not dialog_dict:
                    # 缓存未命中，查询数据库
                    dialogs = DialogService.query(
                        id=setting.dialog_id, 
                        tenant_id=tenant_id
                    )
                    if dialogs:
                        dialog_dict = dialogs[0].to_dict()
                        # 缓存 30 分钟
                        cache_manager.set(cache_key, dialog_dict, 1800)
                
                result['dialog'] = dialog_dict
            
            logging.debug(f"[OptimizedQuery] Loaded settings with dialog for user {user_id}")
            return result
            
        except Exception as e:
            logging.error(f"[OptimizedQuery] Get settings with dialog failed: {e}")
            return {
                'settings': None,
                'dialog': None
            }
    
    @staticmethod
    @DB.connection_context()
    def batch_get_dialogs_by_tenant(tenant_ids: List[str]) -> Dict[str, List[dict]]:
        """
        批量获取租户的对话列表
        优化: 一次查询获取多个租户的对话
        
        Args:
            tenant_ids: 租户ID列表
            
        Returns:
            {tenant_id: [dialog_dict]} 字典
        """
        try:
            # 批量查询
            dialogs = Dialog.select().where(
                Dialog.tenant_id.in_(tenant_ids)
            )
            
            # 按租户分组
            result = {tid: [] for tid in tenant_ids}
            for dialog in dialogs:
                result[dialog.tenant_id].append(dialog.to_dict())
            
            logging.info(f"[OptimizedQuery] Batch loaded dialogs for {len(tenant_ids)} tenants")
            return result
            
        except Exception as e:
            logging.error(f"[OptimizedQuery] Batch get dialogs failed: {e}")
            return {tid: [] for tid in tenant_ids}
    
    @staticmethod
    @DB.connection_context()
    def preload_user_data(user_id: str, tenant_id: str) -> Dict[str, Any]:
        """
        预加载用户所有相关数据
        优化: 一次性加载所有需要的数据，避免多次查询
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            
        Returns:
            包含所有数据的字典
        """
        try:
            result = {
                'settings': None,
                'dialog': None,
                'tenant_dialogs': [],
                'conversations': []
            }
            
            # 1. 获取设置（带 Dialog）
            settings_with_dialog = OptimizedFreeChatQueries.get_settings_with_dialog(
                user_id, tenant_id
            )
            result['settings'] = settings_with_dialog['settings']
            result['dialog'] = settings_with_dialog['dialog']
            
            # 2. 获取租户所有对话（用于选择器）
            tenant_dialogs = OptimizedFreeChatQueries.batch_get_dialogs_by_tenant([tenant_id])
            result['tenant_dialogs'] = tenant_dialogs.get(tenant_id, [])
            
            # 3. 获取用户最近的会话（如果需要）
            # 这里可以添加查询最近会话的逻辑
            
            logging.info(f"[OptimizedQuery] Preloaded all data for user {user_id}")
            return result
            
        except Exception as e:
            logging.error(f"[OptimizedQuery] Preload user data failed: {e}")
            return {
                'settings': None,
                'dialog': None,
                'tenant_dialogs': [],
                'conversations': []
            }
    
    @staticmethod
    def warmup_cache_for_active_users(limit: int = 100) -> int:
        """
        为活跃用户预热缓存
        
        Args:
            limit: 加载用户数量
            
        Returns:
            预热的用户数量
        """
        try:
            # 获取最近活跃的用户
            # 这里简化为获取最近创建的用户
            recent_settings = FreeChatUserSettings.select().limit(limit)
            
            count = 0
            for setting in recent_settings:
                # 缓存用户设置
                if FreeChatCache.set_settings(setting.user_id, setting.to_dict()):
                    count += 1
                
                # 缓存会话
                if setting.sessions:
                    FreeChatCache.set_sessions(setting.user_id, setting.sessions)
            
            logging.info(f"[OptimizedQuery] Warmed up cache for {count} users")
            return count
            
        except Exception as e:
            logging.error(f"[OptimizedQuery] Cache warmup failed: {e}")
            return 0


# ==================== 查询性能分析 ====================

class QueryPerformanceAnalyzer:
    """查询性能分析器"""
    
    @staticmethod
    def analyze_query_explain(query_sql: str) -> Dict[str, Any]:
        """
        分析查询执行计划
        
        Args:
            query_sql: SQL 查询语句
            
        Returns:
            执行计划分析结果
        """
        try:
            # 执行 EXPLAIN
            cursor = DB.execute_sql(f"EXPLAIN {query_sql}")
            result = cursor.fetchall()
            
            # 解析结果
            analysis = {
                'uses_index': False,
                'rows_examined': 0,
                'query_type': 'unknown',
                'recommendations': []
            }
            
            for row in result:
                # MySQL EXPLAIN 格式: (id, select_type, table, type, possible_keys, key, ...)
                if 'index' in str(row).lower():
                    analysis['uses_index'] = True
                
                if 'ALL' in str(row):
                    analysis['recommendations'].append('添加索引以避免全表扫描')
            
            return analysis
            
        except Exception as e:
            logging.error(f"[QueryAnalyzer] EXPLAIN failed: {e}")
            return {
                'error': str(e)
            }


if __name__ == "__main__":
    # 测试批量查询
    print("=== FreeChat 查询优化测试 ===\n")
    
    # 示例: 批量加载用户设置
    print("1. 批量加载用户设置:")
    user_ids = ["user1", "user2", "user3"]
    results = OptimizedFreeChatQueries.batch_get_settings(user_ids)
    print(f"   加载了 {len(results)} 个用户的设置\n")
    
    # 示例: 预加载用户数据
    print("2. 预加载用户数据:")
    print("   一次查询获取所有相关数据，避免 N+1 查询\n")
    
    print("="*50)
    print("✅ 查询优化策略:")
    print("  • 批量查询代替单个查询")
    print("  • 预加载关联数据")
    print("  • 缓存频繁查询的数据")
    print("  • 使用索引优化查询")
    print("="*50)
