import sys
sys.path.insert(0, 'C:\\Users\\Administrator\\Desktop\\workspace\\ragflow')

try:
    # Try to import the module
    import api.apps.conversation_app
    print("✅ Syntax is correct!")
except SyntaxError as e:
    print(f"❌ Syntax Error:")
    print(f"  File: {e.filename}")
    print(f"  Line {e.lineno}: {e.text}")
    print(f"  Error: {e.msg}")
except Exception as e:
    print(f"⚠️ Import error (not syntax): {type(e).__name__}: {e}")
