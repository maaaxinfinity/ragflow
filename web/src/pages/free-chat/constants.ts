/**
 * FreeChat Constants
 *
 * Centralized constants to avoid magic strings and numbers
 */

// Session naming
export const DEFAULT_SESSION_NAME = '新对话';
export const MAX_SESSION_NAME_LENGTH = 50;

// Session states
export const SESSION_STATE = {
  DRAFT: 'draft' as const,
  ACTIVE: 'active' as const,
} as const;

export type SessionState = (typeof SESSION_STATE)[keyof typeof SESSION_STATE];

// Message sync
export const MESSAGE_SYNC_DEBOUNCE_MS = 300;
export const SYNC_CLEANUP_DELAY_MS = 350; // Slightly longer than debounce

// Settings save debounce
export const SETTINGS_SAVE_DEBOUNCE_MS = 5000;
export const SESSIONS_SAVE_DEBOUNCE_MS = 5000;

// Error messages
export const ERROR_MESSAGES = {
  NO_ASSISTANT_SELECTED: '请先在左侧"助手"标签中选择一个助手',
  NO_DIALOG_ID: '缺少dialog_id参数',
  CREATE_CONVERSATION_FAILED: '创建对话失败',
  REGENERATE_FAILED: '重新生成失败',
  RENAME_FAILED: '重命名失败',
  NETWORK_ERROR: '网络错误',
} as const;

// Draft mechanism
// IMPORTANT: Each model card has ONE and ONLY ONE permanent draft session
// Draft sessions are never deleted, only reset when promoted to active
export const DRAFT_CONFIG = {
  // Maximum number of draft sessions per model card
  MAX_DRAFTS_PER_CARD: 1,
  // Draft session naming
  DEFAULT_DRAFT_NAME: DEFAULT_SESSION_NAME,
  // Whether to auto-create draft when selecting a model card
  AUTO_CREATE_DRAFT: true,
} as const;
