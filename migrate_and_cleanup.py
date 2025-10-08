#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Direct database cleanup script for testing
Run this on the server where RAGFlow is deployed
"""

import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Initialize environment
os.environ.setdefault('PYTHONPATH', project_root)

from api.db.services.conversation_service import ConversationService
from api.db.services.dialog_service import DialogService

def cleanup_user_conversations(tenant_id):
    """
    Clean up all conversations for a specific user/tenant
    
    Args:
        tenant_id: The tenant/user ID to clean
    
    Returns:
        Number of deleted conversations
    """
    print(f"[Cleanup] Starting cleanup for tenant: {tenant_id}")
    
    # Find all dialogs for this tenant
    dialogs = DialogService.query(tenant_id=tenant_id)
    
    if not dialogs:
        print(f"[Cleanup] No dialogs found for tenant {tenant_id}")
        return 0
    
    print(f"[Cleanup] Found {len(dialogs)} dialogs")
    
    total_deleted = 0
    dialog_ids = [d.id for d in dialogs]
    
    for dialog_id in dialog_ids:
        # Get all conversations for this dialog
        convs = ConversationService.query(dialog_id=dialog_id)
        
        print(f"[Cleanup] Dialog {dialog_id}: {len(convs)} conversations")
        
        for conv in convs:
            # Delete conversation
            try:
                ConversationService.delete_by_id(conv.id)
                total_deleted += 1
                print(f"[Cleanup] Deleted conversation: {conv.id}")
            except Exception as e:
                print(f"[Cleanup] Error deleting {conv.id}: {e}")
    
    print(f"[Cleanup] Completed - deleted {total_deleted} conversations")
    return total_deleted

def cleanup_specific_conversation(conversation_id):
    """
    Clean up a specific conversation
    
    Args:
        conversation_id: The conversation ID to delete
        
    Returns:
        True if deleted, False otherwise
    """
    print(f"[Cleanup] Deleting conversation: {conversation_id}")
    
    try:
        e, conv = ConversationService.get_by_id(conversation_id)
        if not e:
            print(f"[Cleanup] Conversation not found: {conversation_id}")
            return False
        
        ConversationService.delete_by_id(conversation_id)
        print(f"[Cleanup] Successfully deleted conversation: {conversation_id}")
        return True
    except Exception as ex:
        print(f"[Cleanup] Error: {ex}")
        return False

if __name__ == "__main__":
    # Test tenant ID
    TEST_TENANT_ID = "c06096ce9e3411f09866eedd5edd0033"
    TEST_CONV_ID = "7728c8161bc6441eada0d58c45514b2d"
    
    print("=" * 60)
    print("RAGFlow Cleanup Script")
    print("=" * 60)
    
    # Option 1: Clean up specific conversation
    print("\nOption 1: Clean up specific conversation")
    print(f"Conversation ID: {TEST_CONV_ID}")
    result = cleanup_specific_conversation(TEST_CONV_ID)
    print(f"Result: {'Success' if result else 'Failed'}")
    
    # Option 2: Clean up all conversations for a user
    print("\n" + "=" * 60)
    print("Option 2: Clean up all conversations for user")
    print(f"Tenant ID: {TEST_TENANT_ID}")
    
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        count = cleanup_user_conversations(TEST_TENANT_ID)
        print(f"\nTotal deleted: {count} conversations")
    else:
        print("\nTo clean ALL conversations, run with: python migrate_and_cleanup.py --all")
    
    print("\n" + "=" * 60)
    print("Cleanup completed")
    print("=" * 60)
