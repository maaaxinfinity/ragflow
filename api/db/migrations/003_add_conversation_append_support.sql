-- Migration: Add conversation append support and optimize for lazy loading
-- Created: 2025-01-08
-- Purpose: Support lazy loading architecture refactor

-- Ensure conversation.message is JSON type (should already be)
ALTER TABLE conversation 
  MODIFY COLUMN message JSON COMMENT 'Message array with real-time append support - Single Source of Truth';

-- Add message_count for quick statistics (optional optimization)
ALTER TABLE conversation
  ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0 COMMENT 'Cached message count for performance';

-- Create index for optimized user conversation queries
CREATE INDEX IF NOT EXISTS idx_conversation_user_updated 
  ON conversation(user_id, update_time DESC);

-- Update help text for clarity
ALTER TABLE conversation
  MODIFY COLUMN message JSON COMMENT 'Message array - SINGLE SOURCE OF TRUTH for all conversation messages';

-- Update free_chat_user_settings.sessions help text
ALTER TABLE free_chat_user_settings
  MODIFY COLUMN sessions JSON COMMENT 'Session metadata ONLY - {id, conversation_id, model_card_id, name, created_at, updated_at, params} - NO MESSAGES!';

-- Migration completed
-- Next step: Run data migration script to move messages from sessions to conversations
