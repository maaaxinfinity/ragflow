-- Migration: Add model_card_id to conversation table
-- Date: 2025-01-07
-- Description: Add model_card_id column to support model card tracking in conversations

-- Add model_card_id column to conversation table
ALTER TABLE conversation ADD COLUMN model_card_id INT NULL;

-- Add index for better query performance
CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id);

-- Migration complete
-- Note: Existing conversations will have NULL model_card_id (backward compatible)
-- New conversations created after this migration MUST include model_card_id
