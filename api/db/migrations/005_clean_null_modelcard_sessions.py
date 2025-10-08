#!/usr/bin/env python3
"""
Migration: Clean sessions with null model_card_id

Purpose:
  - Remove legacy sessions that have model_card_id=null
  - These sessions cannot be used (frontend will disable input)
  - Prevents user confusion and UI errors

Usage:
  python api/db/migrations/005_clean_null_modelcard_sessions.py --dry-run
  python api/db/migrations/005_clean_null_modelcard_sessions.py
"""

import sys
import os
import logging
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from api.db.services.free_chat_user_settings_service import FreeChatUserSettingsService
from api.db.db_models import DB

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def clean_null_modelcard_sessions(dry_run: bool = False):
    """Clean sessions with null model_card_id from all user settings"""
    
    with DB.connection_context():
        # Query all settings
        all_settings = FreeChatUserSettingsService.model.select()
        
        total_users = 0
        total_cleaned = 0
        
        for setting in all_settings:
            total_users += 1
            user_id = setting.user_id
            sessions = setting.sessions or []
            
            if not sessions:
                continue
            
            # Filter out null model_card_id sessions
            original_count = len(sessions)
            cleaned_sessions = [
                s for s in sessions 
                if s.get('model_card_id') is not None
            ]
            cleaned_count = original_count - len(cleaned_sessions)
            
            if cleaned_count > 0:
                total_cleaned += cleaned_count
                logging.info(f"[{user_id}] Cleaned {cleaned_count}/{original_count} sessions")
                
                if not dry_run:
                    # Update database
                    FreeChatUserSettingsService.upsert(
                        user_id,
                        sessions=cleaned_sessions
                    )
                    
                    # Invalidate Redis cache
                    from api.apps.free_chat_app import invalidate_sessions_cache
                    invalidate_sessions_cache(user_id)
        
        logging.info(f"\n{'[DRY RUN] ' if dry_run else ''}Summary:")
        logging.info(f"  Total users: {total_users}")
        logging.info(f"  Total sessions cleaned: {total_cleaned}")
        
        if dry_run:
            logging.info("\n⚠️  This was a DRY RUN. No data was modified.")
            logging.info("   Run without --dry-run to apply changes.")

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    
    print("=" * 60)
    print("Clean Null Model Card Sessions Migration")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'PRODUCTION (will modify data)'}")
    print(f"Time: {datetime.now()}")
    print("=" * 60)
    
    if not dry_run:
        confirm = input("\n⚠️  This will MODIFY database. Type 'yes' to continue: ")
        if confirm.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)
    
    clean_null_modelcard_sessions(dry_run)
    print("\n✅ Migration completed.")
