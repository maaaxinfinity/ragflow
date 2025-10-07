# Database Migrations

This directory contains database migration scripts for RAGFlow.

## Available Migrations

### 001: Model Card ID in FreeChat Sessions
- **File**: `add_model_card_id_to_sessions.py`
- **Affects**: `free_chat_user_settings.sessions` (JSONField)
- **Type**: Data migration (Python script)

### 002: Model Card ID in Conversation Table
- **File**: `002_add_model_card_id_to_conversation.sql`
- **Affects**: `conversation` table structure
- **Type**: Schema migration (SQL)

---

## Migration 001: Model Card System in FreeChat Sessions

### Background

The model card system introduces a new `model_card_id` field to the `sessions` data in `free_chat_user_settings` table. This field links each conversation session to a specific model card (assistant configuration).

### When to Run This Migration

**You only need to run this migration if:**
- You have existing free-chat data in production
- You want to preserve existing sessions after upgrading to the model card system
- Your users have created conversations that need to be associated with a model card

**You do NOT need to run this if:**
- This is a fresh installation
- You're okay with users creating new sessions from scratch

### How to Run the Migration

#### 1. Dry Run (Recommended First)

Preview what will be changed without modifying data:

```bash
cd /path/to/ragflow
python api/db/migrations/add_model_card_id_to_sessions.py --dry-run
```

#### 2. Run with Default Model Card ID

Assign a specific model card ID to all existing sessions:

```bash
python api/db/migrations/add_model_card_id_to_sessions.py --default-card-id=1
```

Replace `1` with the actual model card ID from your law-workspace system.

#### 3. Run with NULL (Allow Selection Later)

Leave model_card_id as NULL for users to select later:

```bash
python api/db/migrations/add_model_card_id_to_sessions.py
```

⚠️ **Note**: Sessions without a model_card_id will need to be reassigned by users.

### Example Output

```
2025-01-15 10:30:00 - INFO - Starting migration (dry_run=False)
2025-01-15 10:30:00 - INFO - Default model_card_id: 1
2025-01-15 10:30:00 - INFO - Found 10 user settings to check
2025-01-15 10:30:00 - INFO - User user123, Session 'Chat 1': Adding model_card_id=1
2025-01-15 10:30:00 - INFO - ✓ Updated user user123
2025-01-15 10:30:01 - INFO -
Migration completed:
  - Total users checked: 10
  - Users updated: 8
  - Errors: 0
```

### Rollback

If you need to rollback (remove model_card_id from sessions):

```bash
# No automated rollback script provided
# Manually edit the database or restore from backup if needed
```

### Backup Recommendation

**Always backup your database before running migrations:**

```bash
# MySQL backup
mysqldump -u root -p rag_flow free_chat_user_settings > backup_free_chat_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
mysql -u root -p rag_flow < backup_free_chat_YYYYMMDD_HHMMSS.sql
```

## Database Schema

### Before Migration

```json
{
  "sessions": [
    {
      "id": "uuid-1",
      "conversation_id": "conv-123",
      "name": "Chat 1",
      "messages": [...],
      "created_at": 1234567890,
      "updated_at": 1234567890
    }
  ]
}
```

### After Migration

```json
{
  "sessions": [
    {
      "id": "uuid-1",
      "conversation_id": "conv-123",
      "model_card_id": 1,  // ← Added field
      "name": "Chat 1",
      "messages": [...],
      "created_at": 1234567890,
      "updated_at": 1234567890
    }
  ]
}
```

## Troubleshooting

### Error: "No module named 'api'"

Make sure you run the script from the RAGFlow root directory:

```bash
cd /path/to/ragflow
python api/db/migrations/add_model_card_id_to_sessions.py
```

### Error: Database connection failed

Check your database configuration in `docker/.env` or environment variables.

### Sessions still showing without model card

1. Verify migration ran successfully (check output)
2. Clear Redis cache if using session caching
3. Restart the backend service

---

## Migration 002: Model Card ID in Conversation Table

### Background

This migration adds `model_card_id` field to the `conversation` table to track which model card (assistant) is being used for each conversation. Additionally, request parameters (temperature, top_p, etc.) are now stored in each message's `params` field.

### When to Run This Migration

**Required for all installations** upgrading to the model card system.

### How to Run the Migration

#### MySQL

```bash
# Connect to database
mysql -u root -p rag_flow

# Run migration
source api/db/migrations/002_add_model_card_id_to_conversation.sql

# Verify
DESCRIBE conversation;
# Should show new column: model_card_id (int, nullable, indexed)
```

#### PostgreSQL

```bash
# Connect to database
psql -U postgres -d rag_flow

# Run migration
\i api/db/migrations/002_add_model_card_id_to_conversation.sql

# Verify
\d conversation
```

### Schema Changes

**Before:**
```sql
CREATE TABLE conversation (
    id VARCHAR(32) PRIMARY KEY,
    dialog_id VARCHAR(32) NOT NULL,
    name VARCHAR(255),
    message JSON,
    reference JSON,
    user_id VARCHAR(255),
    create_time BIGINT,
    create_date VARCHAR(30),
    update_time BIGINT,
    update_date VARCHAR(30),
    INDEX idx_dialog_id (dialog_id),
    INDEX idx_user_id (user_id)
);
```

**After:**
```sql
CREATE TABLE conversation (
    -- ... existing columns ...
    model_card_id INT NULL,  -- NEW: Model card ID
    INDEX idx_model_card_id (model_card_id)  -- NEW: Index
);
```

### Message Format Changes

Each message in `conversation.message` JSONField now includes request parameters:

**User Message:**
```json
{
  "role": "user",
  "content": "Hello",
  "id": "msg-123",
  "created_at": 1234567890,
  "params": {                    // NEW: Request parameters
    "temperature": 0.7,
    "top_p": 0.9,
    "model_card_id": 1,
    "max_tokens": 2000
  }
}
```

**Assistant Message:**
```json
{
  "role": "assistant",
  "content": "Hi there!",
  "id": "msg-124",
  "created_at": 1234567891,
  "response_metadata": {         // NEW: Response metadata
    "tokens": 150,
    "duration": 1.23
  }
}
```

### API Changes

The `/v1/conversation/completion` API now **requires** `model_card_id` parameter:

**Before (optional):**
```json
{
  "conversation_id": "conv-123",
  "messages": [...],
  "model_card_id": 1  // Optional
}
```

**After (required):**
```json
{
  "conversation_id": "conv-123",
  "messages": [...],
  "model_card_id": 1  // REQUIRED - API returns error if missing
}
```

### Backward Compatibility

- Existing conversations with `model_card_id = NULL` will still work
- Frontend must include `model_card_id` in all new requests
- Old conversations without params in messages continue to function

### Rollback

To rollback this migration:

```sql
-- Remove column
ALTER TABLE conversation DROP COLUMN model_card_id;

-- Remove index (if created separately)
DROP INDEX idx_conversation_model_card_id ON conversation;
```

⚠️ **Warning**: This will delete all model card associations in existing conversations.

## Support

For issues or questions, please check:
- RAGFlow documentation: https://docs.ragflow.io
- GitHub issues: https://github.com/infiniflow/ragflow/issues
