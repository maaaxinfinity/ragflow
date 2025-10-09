/**
 * 测试导入文件 - 验证所有模块可以正确导入
 * 
 * 使用方法:
 * 1. 临时将此文件导入到 index.tsx 中
 * 2. 启动开发服务器
 * 3. 检查控制台是否有错误
 * 4. 测试完成后删除导入
 */

// Store导入测试
import { useSessionStore, IFreeChatSession, sessionSelectors } from './store/session';
import { useMessageStore, messageSelectors } from './store/message';

// 优化Hooks导入测试
import {
  useSessions,
  useCurrentSession,
  useCurrentSessionId,
  useSessionActions,
  useMessageActions,
  useChatState,
} from './store/hooks';

// 原有Hooks导入测试
import { useFreeChatSession } from './hooks/use-free-chat-session';
import { useFreeChatEnhanced } from './hooks/use-free-chat-enhanced';
import { useFreeChat } from './hooks/use-free-chat';

// 类型导入测试
import type { Message } from '@/interfaces/database/chat';

console.log('✅ 所有导入测试通过！');
console.log('Stores:', { useSessionStore, useMessageStore });
console.log('Hooks:', { useSessions, useCurrentSession, useFreeChatSession });
console.log('Types:', { IFreeChatSession });

// 导出一个测试函数
export const testStoreIntegrity = () => {
  console.log('开始测试Store完整性...');
  
  try {
    // 测试Session Store
    const sessionStore = useSessionStore.getState();
    console.log('✅ Session Store可访问');
    console.log('  - sessions:', sessionStore.sessions.length);
    console.log('  - currentSessionId:', sessionStore.currentSessionId);
    
    // 测试Message Store
    const messageStore = useMessageStore.getState();
    console.log('✅ Message Store可访问');
    console.log('  - messages:', Object.keys(messageStore.messages).length);
    
    // 测试Selectors
    console.log('✅ Selectors可用');
    console.log('  - sessionSelectors:', Object.keys(sessionSelectors));
    console.log('  - messageSelectors:', Object.keys(messageSelectors));
    
    console.log('\n🎉 所有Store测试通过！');
    return true;
  } catch (error) {
    console.error('❌ Store测试失败:', error);
    return false;
  }
};

// 如果在浏览器环境，自动运行测试
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testStoreIntegrity();
  }, 1000);
}
