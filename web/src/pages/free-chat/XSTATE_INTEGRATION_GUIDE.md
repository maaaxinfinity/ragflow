# XState Integration Guide for FreeChat Sessions

**Created**: 2025-01-11  
**Status**: Implementation Guide  
**Purpose**: Integrate XState for robust session state management

---

## 🎯 Why XState?

### Current Issues
1. **Draft ↔ Active transitions**: Manual state management prone to errors
2. **Race conditions**: Multiple async operations can conflict
3. **State consistency**: No guaranteed atomic transitions
4. **Testing difficulty**: Hard to test all state combinations

### XState Benefits
1. **Explicit state machine**: Clear definition of all states and transitions
2. **Guaranteed atomicity**: State transitions are atomic and predictable
3. **Built-in guards**: Prevent invalid transitions
4. **Testability**: Easy to test all paths through state machine
5. **Visualization**: Auto-generate state diagrams

---

## 📦 Installation

```bash
cd web
npm install xstate @xstate/react
# or
yarn add xstate @xstate/react
```

---

## 🏗️ State Machine Design

### Session States

```
┌─────────────────────────────────────────────────────────┐
│                   Session Lifecycle                     │
└─────────────────────────────────────────────────────────┘

IDLE (Initial)
    ↓ SELECT_CARD
DRAFT (Permanent, one per card)
    ├─ name: '新对话'
    ├─ messages: []
    ├─ params: {}
    └─ model_card_id: number
    ↓ SEND_MESSAGE
PROMOTING (Transition state)
    ├─ Creating backend conversation
    ├─ Resetting draft
    └─ Creating active session
    ↓ SUCCESS
ACTIVE (Persisted to backend)
    ├─ conversation_id: string
    ├─ messages: Message[]
    └─ params: object
    ↓ DELETE / ARCHIVE
DELETED / ARCHIVED
```

### Session State Machine Definition

```typescript
// store/session-machine.ts
import { createMachine, assign } from 'xstate';
import { IFreeChatSession } from './session';

interface SessionContext {
  session: IFreeChatSession;
  error?: Error;
  pendingConversationId?: string;
}

type SessionEvent =
  | { type: 'SELECT_CARD'; model_card_id: number }
  | { type: 'SEND_MESSAGE'; message: any }
  | { type: 'PROMOTION_SUCCESS'; conversation_id: string }
  | { type: 'PROMOTION_FAILURE'; error: Error }
  | { type: 'UPDATE'; updates: Partial<IFreeChatSession> }
  | { type: 'DELETE' }
  | { type: 'ARCHIVE' };

export const sessionMachine = createMachine<SessionContext, SessionEvent>(
  {
    id: 'freeChatSession',
    initial: 'idle',
    context: {
      session: null as any,
      error: undefined,
      pendingConversationId: undefined,
    },
    states: {
      idle: {
        on: {
          SELECT_CARD: {
            target: 'draft',
            actions: 'initializeDraft',
          },
        },
      },
      draft: {
        on: {
          SEND_MESSAGE: {
            target: 'promoting',
            actions: 'preparePromotion',
          },
          UPDATE: {
            actions: 'updateSession',
          },
        },
      },
      promoting: {
        invoke: {
          id: 'promoteToActive',
          src: 'promoteDraftToActive',
          onDone: {
            target: 'active',
            actions: 'handlePromotionSuccess',
          },
          onError: {
            target: 'draft',
            actions: 'handlePromotionFailure',
          },
        },
      },
      active: {
        on: {
          UPDATE: {
            actions: 'updateSession',
          },
          DELETE: 'deleted',
          ARCHIVE: 'archived',
        },
      },
      deleted: {
        type: 'final',
      },
      archived: {
        on: {
          UPDATE: {
            actions: 'updateSession',
          },
        },
      },
    },
  },
  {
    actions: {
      initializeDraft: assign({
        session: (context, event) => ({
          id: `draft_${event.model_card_id}_${Date.now()}`,
          model_card_id: event.model_card_id,
          name: '新对话',
          messages: [],
          created_at: Date.now(),
          updated_at: Date.now(),
          state: 'draft' as const,
          params: {},
        }),
      }),
      
      preparePromotion: assign({
        pendingConversationId: undefined,
        error: undefined,
      }),
      
      handlePromotionSuccess: assign({
        session: (context, event: any) => ({
          ...context.session,
          id: event.data.conversation_id,
          conversation_id: event.data.conversation_id,
          state: 'active' as const,
          updated_at: Date.now(),
        }),
        pendingConversationId: undefined,
      }),
      
      handlePromotionFailure: assign({
        error: (context, event: any) => event.data,
        pendingConversationId: undefined,
      }),
      
      updateSession: assign({
        session: (context, event: any) => ({
          ...context.session,
          ...event.updates,
          updated_at: Date.now(),
        }),
      }),
    },
    
    services: {
      promoteDraftToActive: async (context, event: any) => {
        // Call backend API to create conversation
        const response = await fetch('/v1/conversation/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dialog_id: event.message.dialog_id,
            name: event.message.content.slice(0, 50),
            is_new: true,
            model_card_id: context.session.model_card_id,
            message: [{ role: 'assistant', content: '' }],
          }),
        });
        
        const result = await response.json();
        
        if (result.code !== 0) {
          throw new Error(result.message);
        }
        
        return {
          conversation_id: result.data.id,
        };
      },
    },
  }
);
```

---

## 🔌 Integration with Zustand Store

### Updated Store with XState

```typescript
// store/session.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { interpret } from 'xstate';
import { sessionMachine } from './session-machine';
import { v4 as uuid } from 'uuid';
import type { Message } from '@/interfaces/database/chat';

// ... IFreeChatSession interface ...

interface SessionState {
  sessions: IFreeChatSession[];
  currentSessionId: string;
  isLoading: boolean;
  
  // XState actors (one per session)
  sessionActors: Map<string, any>;
}

interface SessionActions {
  // ... existing actions ...
  
  // XState-powered actions
  sendMessageWithStateMachine: (sessionId: string, message: Message) => Promise<void>;
  getOrCreateDraftForCardWithStateMachine: (model_card_id: number) => IFreeChatSession;
}

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    devtools(
      (set, get) => ({
        sessions: [],
        currentSessionId: '',
        isLoading: false,
        sessionActors: new Map(),
        
        // ... existing actions ...
        
        // XState integration
        sendMessageWithStateMachine: async (sessionId, message) => {
          const { sessionActors, sessions } = get();
          
          // Get or create actor for this session
          let actor = sessionActors.get(sessionId);
          if (!actor) {
            const session = sessions.find(s => s.id === sessionId);
            actor = interpret(
              sessionMachine.withContext({
                session: session!,
                error: undefined,
                pendingConversationId: undefined,
              })
            ).start();
            
            sessionActors.set(sessionId, actor);
          }
          
          // Send message event to state machine
          actor.send({ type: 'SEND_MESSAGE', message });
          
          // Listen for state changes
          actor.onTransition((state) => {
            if (state.matches('active')) {
              // Update session in store
              const updatedSession = state.context.session;
              set((prev) => ({
                sessions: prev.sessions.map(s =>
                  s.id === sessionId ? updatedSession : s
                ),
              }));
            }
          });
        },
        
        getOrCreateDraftForCardWithStateMachine: (model_card_id) => {
          const { sessions, sessionActors } = get();
          
          // Check for existing draft
          const existingDraft = sessions.find(
            s => s.state === 'draft' && s.model_card_id === model_card_id
          );
          
          if (existingDraft) {
            return existingDraft;
          }
          
          // Create new draft using state machine
          const actor = interpret(sessionMachine).start();
          actor.send({ type: 'SELECT_CARD', model_card_id });
          
          const newDraft = actor.getSnapshot().context.session;
          
          sessionActors.set(newDraft.id, actor);
          
          set((state) => ({
            sessions: [newDraft, ...state.sessions],
          }));
          
          return newDraft;
        },
      }),
      { name: 'FreeChat_Session' }
    ),
    { name: 'freechat-session-storage' }
  )
);
```

---

## 🎨 React Hook Integration

### useMachine Hook

```typescript
// hooks/use-session-machine.ts
import { useMachine } from '@xstate/react';
import { sessionMachine } from '../store/session-machine';
import { useCallback } from 'react';
import { IFreeChatSession } from '../store/session';

export const useSessionMachine = (initialSession?: IFreeChatSession) => {
  const [state, send] = useMachine(sessionMachine, {
    context: {
      session: initialSession || null as any,
      error: undefined,
      pendingConversationId: undefined,
    },
  });
  
  const sendMessage = useCallback((message: any) => {
    send({ type: 'SEND_MESSAGE', message });
  }, [send]);
  
  const updateSession = useCallback((updates: Partial<IFreeChatSession>) => {
    send({ type: 'UPDATE', updates });
  }, [send]);
  
  const deleteSession = useCallback(() => {
    send({ type: 'DELETE' });
  }, [send]);
  
  return {
    session: state.context.session,
    state: state.value,
    isPromoting: state.matches('promoting'),
    isDraft: state.matches('draft'),
    isActive: state.matches('active'),
    error: state.context.error,
    sendMessage,
    updateSession,
    deleteSession,
  };
};
```

---

## 🧪 Testing with XState

### State Machine Tests

```typescript
// store/__tests__/session-machine.test.ts
import { interpret } from 'xstate';
import { sessionMachine } from '../session-machine';

describe('Session State Machine', () => {
  it('should transition from idle to draft when selecting card', (done) => {
    const actor = interpret(sessionMachine)
      .onTransition((state) => {
        if (state.matches('draft')) {
          expect(state.context.session.model_card_id).toBe(123);
          expect(state.context.session.name).toBe('新对话');
          done();
        }
      })
      .start();
    
    actor.send({ type: 'SELECT_CARD', model_card_id: 123 });
  });
  
  it('should handle promotion failure and rollback to draft', (done) => {
    const actor = interpret(sessionMachine)
      .onTransition((state) => {
        if (state.matches('draft') && state.context.error) {
          expect(state.context.error).toBeDefined();
          done();
        }
      })
      .start();
    
    // Initialize draft
    actor.send({ type: 'SELECT_CARD', model_card_id: 123 });
    
    // Attempt promotion (will fail in test)
    actor.send({ type: 'SEND_MESSAGE', message: { content: 'test' } });
  });
  
  it('should prevent invalid transitions', () => {
    const actor = interpret(sessionMachine).start();
    
    // Should not allow DELETE from idle state
    actor.send({ type: 'DELETE' });
    expect(actor.getSnapshot().matches('idle')).toBe(true);
  });
});
```

---

## 📊 Visualization

XState provides built-in visualization tools:

```typescript
// visualize-session-machine.ts
import { sessionMachine } from './store/session-machine';
import { createMachine } from 'xstate';
import { inspect } from '@xstate/inspect';

// Enable inspector in development
if (process.env.NODE_ENV === 'development') {
  inspect({
    iframe: false, // Use browser extension
  });
}

// You can also export the machine config for Stately.ai visualizer
console.log(JSON.stringify(sessionMachine.config));
```

Visit https://stately.ai/viz to visualize the state machine.

---

## 🚀 Migration Steps

### Step 1: Install XState
```bash
npm install xstate @xstate/react
```

### Step 2: Create State Machine
Create `store/session-machine.ts` with the definition above.

### Step 3: Update Store
Integrate XState actors into `store/session.ts`.

### Step 4: Update Hooks
Modify `hooks/use-free-chat.ts` to use state machine for Draft→Active transitions.

### Step 5: Test
Add comprehensive tests for all state transitions.

### Step 6: Gradual Rollout
- Keep existing Zustand implementation
- Add XState for Draft→Active only
- Monitor for issues
- Expand to other state transitions

---

## 🎯 Benefits After Migration

### Before (Manual State Management)
```typescript
// Prone to race conditions and state inconsistency
if (!conversationId) {
  const convData = await updateConversation({...});
  conversationId = convData.data.id;
  
  resetDraft(draftId);
  createSession(name, modelCardId, false, conversationId);
  updateSession(conversationId, { params: draftParams });
  // What if any of these fail? Partial state!
}
```

### After (XState)
```typescript
// Guaranteed atomic transition
send({ type: 'SEND_MESSAGE', message });
// State machine handles:
// 1. Backend API call
// 2. Success → Atomic transition to Active
// 3. Failure → Rollback to Draft with error
// 4. All intermediate states tracked
```

---

## 📚 References

- [XState Documentation](https://xstate.js.org/docs/)
- [XState Visualizer](https://stately.ai/viz)
- [@xstate/react](https://xstate.js.org/docs/packages/xstate-react/)
- [State Machine Design Patterns](https://xstate.js.org/docs/patterns/)

---

## ✅ Checklist

- [ ] Install xstate and @xstate/react
- [ ] Create session-machine.ts
- [ ] Update session.ts store
- [ ] Update use-free-chat.ts hook
- [ ] Add tests for state machine
- [ ] Test Draft→Active transitions
- [ ] Visualize state machine
- [ ] Document any edge cases
- [ ] Monitor in production
- [ ] Expand to other transitions

---

**Author**: Claude Code Agent  
**Last Updated**: 2025-01-11  
**Status**: Ready for Implementation
