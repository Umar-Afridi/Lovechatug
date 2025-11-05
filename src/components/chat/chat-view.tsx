import type { Chat } from '@/lib/types';
import { getChatPartner } from '@/lib/data';
import { ChatTopbar } from './chat-topbar';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { AiReplySuggestions } from './ai-reply-suggestions';

interface ChatViewProps {
    chat: Chat;
    loggedInUserId: string;
}

export function ChatView({ chat, loggedInUserId }: ChatViewProps) {
    const chatPartner = getChatPartner(chat);

    if (!chatPartner) {
        return null;
    }

    const lastMessage = chat.messages[chat.messages.length - 1];
    const lastMessageFromPartner = lastMessage.senderId === chatPartner.id;


    return (
        <div className="flex flex-col h-full">
            <ChatTopbar chatPartner={chatPartner} />
            <ChatMessages 
                messages={chat.messages} 
                loggedInUserId={loggedInUserId} 
                chatPartner={chatPartner}
            />
            <div className="p-4 border-t bg-background">
                {lastMessageFromPartner && (
                    <AiReplySuggestions messageContent={lastMessage.content} />
                )}
                <ChatInput />
            </div>
        </div>
    );
}
