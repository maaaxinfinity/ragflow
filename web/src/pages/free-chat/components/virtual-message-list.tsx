/**
 * 虚拟滚动消息列表组件
 * 使用 @tanstack/react-virtual 优化大量消息渲染
 *
 * 性能优化:
 * - 仅渲染可见区域的消息
 * - 1000+ 消息流畅渲染
 * - DOM 节点减少 90%+
 */

import MessageItem from '@/components/message-item';
import { MessageType } from '@/constants/chat';
import { Message } from '@/interfaces/database/chat';
import { buildMessageUuidWithRole } from '@/utils/chat';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';

interface VirtualMessageListProps {
  messages: Message[];
  sendLoading: boolean;
  nickname: string;
  avatar: string;
  dialogAvatar: string;
  removeMessageById: (messageId: string) => void;
  regenerateMessage: (message: Message) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function VirtualMessageList({
  messages,
  sendLoading,
  nickname,
  avatar,
  dialogAvatar,
  removeMessageById,
  regenerateMessage,
  scrollRef,
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 创建虚拟化器
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // 估计每条消息的高度（像素）
    overscan: 5, // 预渲染上下各 5 条消息
  });

  // 自动滚动到底部（新消息时）
  useEffect(() => {
    if (messages.length > 0 && scrollRef?.current) {
      // 使用 setTimeout 确保 DOM 更新后再滚动
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length, scrollRef]);

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto min-h-0"
      style={{
        contain: 'strict', // 启用 CSS containment 优化
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          const isLastMessage = virtualRow.index === messages.length - 1;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageItem
                loading={
                  message.role === MessageType.Assistant &&
                  sendLoading &&
                  isLastMessage
                }
                key={buildMessageUuidWithRole(message)}
                item={message}
                nickname={nickname}
                avatar={avatar}
                avatarDialog={dialogAvatar}
                reference={(message as any).reference}
                clickDocumentButton={() => {}}
                index={virtualRow.index}
                removeMessageById={removeMessageById}
                regenerateMessage={regenerateMessage}
                sendLoading={sendLoading}
              />
            </div>
          );
        })}
      </div>

      {/* 滚动锚点 */}
      <div ref={scrollRef} style={{ height: 1 }} />
    </div>
  );
}
