#!/usr/bin/env python3
"""
Migration: Clean error messages from conversations

Purpose:
  - Remove assistant messages that contain "**ERROR**" text
  - These are failed completions that were saved to database
  - Prevents users from seeing error messages in chat history

Usage:
  python api/db/migrations/006_clean_error_messages.py --dry-run
  python api/db/migrations/006_clean_error_messages.py
"""

import sys
import os
import logging
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from api.db.services.conversation_service import ConversationService
from api.db.db_models import DB

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def clean_error_messages(dry_run: bool = False):
    """Clean error messages from all conversations"""
    
    with DB.connection_context():
        # Query all conversations
        all_conversations = ConversationService.model.select()
        
        total_conversations = 0
        total_cleaned = 0
        
        for conv in all_conversations:
            total_conversations += 1
            conversation_id = conv.id
            messages = conv.message or []
            
            if not messages:
                continue
            
            # Filter out error messages
            original_count = len(messages)
            cleaned_messages = [
                msg for msg in messages
                if not (
                    msg.get('role') == 'assistant' and
                    isinstance(msg.get('content'), str) and
                    '**ERROR**' in msg.get('content', '')
                )
            ]
            cleaned_count = original_count - len(cleaned_messages)
            
            if cleaned_count > 0:
                total_cleaned += cleaned_count
                logging.info(f"[{conversation_id}] Cleaned {cleaned_count}/{original_count} error messages")
                
                if not dry_run:
                    # Update conversation
                    conv.message = cleaned_messages
                    conv.save()
        
        logging.info(f"\n{'[DRY RUN] ' if dry_run else ''}Summary:")
        logging.info(f"  Total conversations: {total_conversations}")
        logging.info(f"  Total error messages cleaned: {total_cleaned}")
        
        if dry_run:
            logging.info("\n⚠️  This was a DRY RUN. No data was modified.")
            logging.info("   Run without --dry-run to apply changes.")

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    
    print("=" * 60)
    print("Clean Error Messages Migration")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'PRODUCTION (will modify data)'}")
    print(f"Time: {datetime.now()}")
    print("=" * 60)
    
    if not dry_run:
        confirm = input("\n⚠️  This will MODIFY database. Type 'yes' to continue: ")
        if confirm.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)
    
    clean_error_messages(dry_run)
    print("\n✅ Migration completed.")
