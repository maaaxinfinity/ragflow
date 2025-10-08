# RAGFlow Database Migrations

This directory contains database migration scripts for RAGFlow.

## Migration Overview

| Migration | Description | Type | Date |
|-----------|-------------|------|------|
| 003_add_conversation_append_support.sql | Add conversation append support (Schema) | SQL | 2025-01-08 |
| 004_migrate_sessions_messages.py | Migrate sessions messages to conversation table (Data) | Python | 2025-01-08 |

## How to Run Migrations

### Schema Migrations (Automatic)

Schema migrations (like 003_*.sql) are **automatically executed** by the `migrate_db()` function in `api/db/db_models.py` during system startup. No manual intervention needed.

### Data Migrations (Manual)

Data migrations (like 004_*.py) must be run **manually once** before deploying the new code.

**Example: 004_migrate_sessions_messages.py**

```bash
# 1. Backup database (REQUIRED)
mysqldump -u root -p ragflow > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Dry run (preview changes without modifying data)
python api/db/migrations/004_migrate_sessions_messages.py --dry-run

# 3. Execute migration
python api/db/migrations/004_migrate_sessions_messages.py

# 4. Verify migration
python api/db/migrations/004_migrate_sessions_messages.py --verify
```

## Migration 004: FreeChat Architecture Refactor

**Purpose**: Optimize FreeChat performance by separating message storage from session metadata.

**Changes**:
- Moves messages from `free_chat_user_settings.sessions` to `conversation.message`
- Updates sessions to contain only metadata (id, name, conversation_id, params, message_count)
- Enables lazy loading of messages for 8.3x performance improvement

**Idempotency**: Safe to run multiple times - skips already migrated data.

**Rollback**: Restore from backup if needed (no automatic rollback).

## Best Practices

1. **Always backup before migrations**
2. **Test with --dry-run first**
3. **Verify data integrity with --verify**
4. **Monitor logs during migration**
5. **Keep backup for at least 7 days**

## Troubleshooting

**Migration fails with "Conversation not found"**:
- This is normal for sessions without conversation_id (new sessions)
- Migration will skip these and only process existing conversations

**Verification fails with "message count mismatch"**:
- Run migration again to update message_count field
- Or manually recalculate counts after migration

**Redis cache contains old format**:
- Clear Redis cache after migration: `redis-cli KEYS "freechat:sessions:*" | xargs redis-cli DEL`

## Contact

For migration issues, check logs in `migration_004.log` or contact the development team.
