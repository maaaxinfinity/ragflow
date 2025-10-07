# Database Migrations

This directory contains database migration scripts for RAGFlow.

## Model Card System Migration

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

## Support

For issues or questions, please check:
- RAGFlow documentation: https://docs.ragflow.io
- GitHub issues: https://github.com/infiniflow/ragflow/issues
