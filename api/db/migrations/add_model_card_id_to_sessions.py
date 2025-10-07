#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Migration script to add model_card_id to existing sessions data

This script is OPTIONAL and only needed if you have existing free_chat_user_settings
data that needs to be migrated to the new model card system.

Usage:
    python api/db/migrations/add_model_card_id_to_sessions.py [--default-card-id=<id>]

Options:
    --default-card-id=<id>    Default model card ID to assign to existing sessions [default: null]
    --dry-run                 Show what would be changed without making changes
"""

import sys
import json
import logging
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from api.db.db_models import DB, FreeChatUserSettings
from api.db.services.free_chat_user_settings_service import FreeChatUserSettingsService

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_sessions_data(default_model_card_id=None, dry_run=False):
    """
    Add model_card_id field to existing sessions data

    Args:
        default_model_card_id: Default model card ID to assign to sessions without one
        dry_run: If True, only show what would be changed without making changes
    """
    logger.info(f"Starting migration (dry_run={dry_run})")
    logger.info(f"Default model_card_id: {default_model_card_id}")

    updated_count = 0
    error_count = 0

    try:
        with DB.connection_context():
            # Get all user settings
            all_settings = FreeChatUserSettings.select()
            total_users = all_settings.count()

            logger.info(f"Found {total_users} user settings to check")

            for settings in all_settings:
                try:
                    sessions = settings.sessions
                    if not sessions:
                        continue

                    modified = False
                    for session in sessions:
                        # Check if model_card_id already exists
                        if 'model_card_id' not in session:
                            # Add model_card_id field
                            session['model_card_id'] = default_model_card_id
                            modified = True
                            logger.info(
                                f"User {settings.user_id}, Session '{session.get('name', 'N/A')}': "
                                f"Adding model_card_id={default_model_card_id}"
                            )

                    if modified:
                        if not dry_run:
                            # Update in database
                            FreeChatUserSettings.update(sessions=sessions).where(
                                FreeChatUserSettings.user_id == settings.user_id
                            ).execute()
                            logger.info(f"✓ Updated user {settings.user_id}")
                        else:
                            logger.info(f"[DRY RUN] Would update user {settings.user_id}")

                        updated_count += 1

                except Exception as e:
                    logger.error(f"Error processing user {settings.user_id}: {e}")
                    error_count += 1

        logger.info(f"\nMigration completed:")
        logger.info(f"  - Total users checked: {total_users}")
        logger.info(f"  - Users updated: {updated_count}")
        logger.info(f"  - Errors: {error_count}")

        if dry_run:
            logger.info("\n[DRY RUN] No changes were made to the database")

        return updated_count, error_count

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Migrate sessions data to include model_card_id")
    parser.add_argument(
        "--default-card-id",
        type=int,
        default=None,
        help="Default model card ID to assign to existing sessions"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making changes"
    )

    args = parser.parse_args()

    try:
        updated, errors = migrate_sessions_data(
            default_model_card_id=args.default_card_id,
            dry_run=args.dry_run
        )

        if errors > 0:
            sys.exit(1)
        else:
            sys.exit(0)

    except Exception as e:
        logger.error(f"Migration script failed: {e}")
        sys.exit(1)
