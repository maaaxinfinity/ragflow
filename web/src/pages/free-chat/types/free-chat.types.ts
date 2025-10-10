/**
 * FreeChat TypeScript Type Definitions
 * 完善的类型定义系统
 */

import { Message } from '@/interfaces/database/chat';

// ==================== API 响应类型 ====================

export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data: T;
}

export interface ApiError {
  code: number;
  error_code?: string;
  message: string;
  payload?: Record<string, any>;
}

// ==================== 设置相关类型 ====================

export interface ModelParams {
  temperature: number;
  top_p: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
}

export interface FreeChatSession {
  id: string;
  conversation_id?: string;
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
}

export interface FreeChatSettings {
  user_id: string;
  dialog_id: string;
  model_params: ModelParams;
  kb_ids: string[];
  role_prompt: string;
  sessions: FreeChatSession[];
}

// ==================== 用户信息类型 ====================

export interface UserInfo {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  is_su?: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  [key: string]: any;
}

export interface TenantUser {
  user_id: string;
  nickname: string;
  email: string;
  avatar?: string;
  role?: string;
}

// ==================== 对话相关类型 ====================

export interface Dialog {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  llm_id?: string;
  prompt_config?: any;
  kb_ids?: string[];
  [key: string]: any;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  [key: string]: any;
}

// ==================== Props 类型 ====================

export interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  stopOutputMessage: () => void;
  removeMessageById: (messageId: string) => void;
  removeAllMessages: () => void;
  regenerateMessage: (message: Message) => void;
  dialogId: string;
  userAvatar?: string;
  userNickname?: string;
  dialogAvatar?: string;
}

export interface ControlPanelProps {
  dialogId: string;
  onDialogChange: (dialogId: string) => void;
  rolePrompt?: string;
  onRolePromptChange?: (prompt: string) => void;
  modelParams?: ModelParams;
  onModelParamsChange?: (params: ModelParams) => void;
  saving?: boolean;
  hasUnsavedChanges?: boolean;
  onManualSave?: () => void;
  userId?: string;
  currentUserInfo?: TenantUser;
  userInfo?: UserInfo;
  tenantInfo?: TenantInfo;
  isMobile?: boolean;
}

export interface SessionListProps {
  sessions: FreeChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  onNewSession: () => void;
  onClearAll: () => void;
}

// ==================== Hook 返回类型 ====================

export interface UseFreeChatReturn {
  handlePressEnter: () => void;
  handleSendMessage: (content: string) => Promise<void>;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  value: string;
  setValue: (value: string) => void;
  derivedMessages: Message[];
  removeMessageById: (id: string) => void;
  removeAllMessages: () => void;
  regenerateMessage: (message: Message) => Promise<void>;
  sendLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  stopOutputMessage: () => void;
  currentSession?: FreeChatSession;
  currentSessionId: string | null;
  sessions: FreeChatSession[];
  createSession: (name?: string) => string;
  updateSession: (id: string, updates: Partial<FreeChatSession>) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
  dialogId: string;
  setDialogId: (id: string) => void;
}

export interface UseFreeChatSettingsReturn {
  settings: FreeChatSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  updateField: <K extends keyof Omit<FreeChatSettings, 'user_id'>>(
    field: K,
    value: FreeChatSettings[K],
    options?: UpdateFieldOptions,
  ) => void;
  manualSave: () => Promise<boolean>;
  reload: () => Promise<void>;
}

export interface UpdateFieldOptions {
  silent?: boolean;
  immediate?: boolean;
}

// ==================== Store 类型 ====================

export interface FreeChatStore {
  sessions: FreeChatSession[];
  currentSessionId: string | null;
  currentSession: () => FreeChatSession | undefined;
  createSession: (name?: string) => string;
  updateSession: (id: string, updates: Partial<FreeChatSession>) => void;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
  clearAllSessions: () => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  setSessions: (sessions: FreeChatSession[]) => void;
}

// ==================== 请求/响应类型 ====================

export interface SaveSettingsRequest extends FreeChatSettings {}

export interface GetSettingsRequest {
  user_id: string;
}

export interface AdminTokenResponse {
  token: string;
  beta?: string;
  api_key?: string;
}

// ==================== 常量类型 ====================

export const DEFAULT_MODEL_PARAMS: ModelParams = {
  temperature: 0.7,
  top_p: 0.9,
  frequency_penalty: 0,
  presence_penalty: 0,
  max_tokens: 2048,
};

export const DEFAULT_SETTINGS: Omit<FreeChatSettings, 'user_id'> = {
  dialog_id: '',
  model_params: DEFAULT_MODEL_PARAMS,
  kb_ids: [],
  role_prompt: '',
  sessions: [],
};
