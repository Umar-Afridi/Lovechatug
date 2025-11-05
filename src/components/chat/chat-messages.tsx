'use client';

import { useEffect, useRef } from 'react';
import type { Message, User } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { ChatMessage } from './chat-message';

interface ChatMessagesProps {
    messages: Message[];
    loggedInUserId: string;
    chatPartner: User;
}

export function ChatMessages({ messages, loggedInUserId, chatPartner }: ChatMessagesProps) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);

    return (
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="p-4 md:p-6 space-y-6">
                {messages.map((message, index) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        isSentByCurrentUser={message.senderId === loggedInUserId}
                        chatPartner={chatPartner}
                        showAvatar={index === 0 || messages[index - 1].senderId !== message.senderId}
                    />
                ))}
            </div>
        </ScrollArea>
    );
}
