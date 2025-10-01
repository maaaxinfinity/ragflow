import { useState } from 'react';
import { BotManagementPanel } from './components/bot-management-panel';
import { FreeChatListPanel } from './components/freechat-list-panel';

export default function NextChat() {
  const [selectedDialogId, setSelectedDialogId] = useState<string>('');

  return (
    <div className="flex flex-col h-screen">
      {/* Upper Half: Bot Management */}
      <div className="h-1/2 border-b overflow-auto">
        <BotManagementPanel
          onSelectBot={setSelectedDialogId}
          selectedBotId={selectedDialogId}
        />
      </div>

      {/* Lower Half: FreeChat Session List */}
      <div className="h-1/2 overflow-auto">
        <FreeChatListPanel dialogId={selectedDialogId} />
      </div>
    </div>
  );
}
