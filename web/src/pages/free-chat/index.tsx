import { useRef, useEffect, useCallback } from 'react';
import { useFreeChat } from './hooks/use-free-chat';
import { ControlPanel } from './components/control-panel';
import { ChatInterface } from './chat-interface';
import { SessionList } from './components/session-list';
import { KBProvider } from './contexts/kb-context';
import { useFreeChatUserId } from './hooks/use-free-chat-user-id';
import { useFreeChatSettingsApi } from './hooks/use-free-chat-settings-api';
import { Spin } from 'antd';
import { Helmet } from 'umi';

// BUG FIX: Separate component to use hooks inside KBProvider
function FreeChatContent() {
  const controller = useRef(new AbortController());
  const userId = useFreeChatUserId();
  const { settings, loading: settingsLoading, updateField } = useFreeChatSettingsApi(userId);

  const handleSessionsChange = useCallback(
    (sessions: any[]) => {
      if (userId && settings) {
        updateField('sessions', sessions);
      }
    },
    [userId, settings, updateField],
  );

  const {
    handlePressEnter,
    handleInputChange,
    value,
    setValue,
    derivedMessages,
    removeMessageById,
    removeAllMessages,
    regenerateMessage,
    sendLoading,
    scrollRef,
    messageContainerRef,
    stopOutputMessage,
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    clearAllSessions,
    dialogId,
    setDialogId,
  } = useFreeChat(controller.current, userId, settings, handleSessionsChange);

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  const handleDialogChange = useCallback(
    (newDialogId: string) => {
      // Check if dialog actually changed
      if (dialogId && dialogId !== newDialogId) {
        // Dialog changed - create new chat session
        createSession();
      }

      setDialogId(newDialogId);
      if (userId && settings) {
        updateField('dialog_id', newDialogId);
      }
    },
    [dialogId, createSession, setDialogId, userId, settings, updateField],
  );

  const handleRolePromptChange = useCallback(
    (prompt: string) => {
      if (userId && settings) {
        updateField('role_prompt', prompt);
      }
    },
    [userId, settings, updateField],
  );

  const handleModelParamsChange = useCallback(
    (params: any) => {
      if (userId && settings) {
        updateField('model_params', params);
      }
    },
    [userId, settings, updateField],
  );

  // Show loading state while settings are being loaded
  if (settingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Session List */}
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={switchSession}
        onSessionDelete={deleteSession}
        onNewSession={handleNewSession}
        onClearAll={clearAllSessions}
      />

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          messages={derivedMessages}
          onSendMessage={handlePressEnter}
          onInputChange={handleInputChange}
          inputValue={value}
          setInputValue={setValue}
          sendLoading={sendLoading}
          scrollRef={scrollRef}
          messageContainerRef={messageContainerRef}
          stopOutputMessage={stopOutputMessage}
          removeMessageById={removeMessageById}
          removeAllMessages={removeAllMessages}
          regenerateMessage={regenerateMessage}
          dialogId={dialogId}
        />
      </div>

      {/* Control Panel */}
      <ControlPanel
        dialogId={dialogId}
        onDialogChange={handleDialogChange}
        rolePrompt={settings?.role_prompt || ''}
        onRolePromptChange={handleRolePromptChange}
        modelParams={settings?.model_params}
        onModelParamsChange={handleModelParamsChange}
      />
    </div>
  );
}

export default function FreeChat() {
  const userId = useFreeChatUserId();
  const { settings, updateField } = useFreeChatSettingsApi(userId);

  // Apply Source Han Serif font
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://chinese-fonts-cdn.deno.dev/packages/syst/dist/SourceHanSerifCN/result.css';
    document.head.appendChild(link);

    // Apply font to body
    document.body.style.fontFamily = '"Source Han Serif CN", "思源宋体", serif';

    return () => {
      document.head.removeChild(link);
      document.body.style.fontFamily = '';
    };
  }, []);

  return (
    <>
      <Helmet>
        <link
          rel="stylesheet"
          href="https://chinese-fonts-cdn.deno.dev/packages/syst/dist/SourceHanSerifCN/result.css"
        />
      </Helmet>
      <div style={{ fontFamily: '"Source Han Serif CN", "思源宋体", serif' }}>
        <KBProvider
          initialKBs={settings?.kb_ids}
          onKBsChange={(kbIds) => updateField('kb_ids', kbIds)}
        >
          <FreeChatContent />
        </KBProvider>
      </div>
    </>
  );
}
