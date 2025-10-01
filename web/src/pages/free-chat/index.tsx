import { useRef } from 'react';
import { useFreeChat } from './hooks/use-free-chat';
import { ControlPanel } from './components/control-panel';
import { ChatInterface } from './chat-interface';
import { SessionList } from './components/session-list';

export default function FreeChat() {
  const controller = useRef(new AbortController());

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
    paramsChanged,
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    dialogId,
    setDialogId,
  } = useFreeChat(controller.current);

  const handleNewSession = () => {
    createSession();
  };

  return (
    <div className="flex h-screen">
      {/* Session List */}
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={switchSession}
        onSessionDelete={deleteSession}
        onNewSession={handleNewSession}
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
          paramsChanged={paramsChanged}
          dialogId={dialogId}
        />
      </div>

      {/* Control Panel */}
      <ControlPanel
        dialogId={dialogId}
        onDialogChange={setDialogId}
      />
    </div>
  );
}
