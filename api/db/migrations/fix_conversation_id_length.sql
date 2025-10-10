-- Fix conversation.id field length to support full UUID format (36 chars)
-- UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (32 hex + 4 hyphens = 36 chars)
-- Previous: VARCHAR(32) - truncated UUIDs and caused "Conversation not found" errors
-- Fixed: VARCHAR(36) - supports full UUID format

ALTER TABLE `conversation` MODIFY COLUMN `id` VARCHAR(36) NOT NULL;
