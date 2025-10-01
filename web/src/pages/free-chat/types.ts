import { IConversation, Message } from '@/interfaces/database/chat';

// 动态模型参数
export interface DynamicModelParams {
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
}

// Free Chat对话
export interface IFreeChatConversation extends IConversation {
  bookmarked?: boolean; // 是否收藏
  tags?: string[]; // 标签
}

// Free Chat消息
export interface IFreeChatMessage extends Message {
  id: string;
  model_params?: DynamicModelParams; // 该消息使用的模型参数
  kb_ids?: string[]; // 该消息使用的知识库
}

// 对话会话配置
export interface IFreeChatSession {
  id: string;
  name: string;
  messages: IFreeChatMessage[];
  current_model_params: DynamicModelParams;
  enabled_kb_ids: string[];
  bookmarked: boolean;
  tags: string[];
  created_at: number;
  updated_at: number;
}
