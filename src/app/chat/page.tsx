'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatDetail } from '@/components/chat/chat-detail';
import type { Chat } from '@/lib/types';


// Mock data, will be replaced with Firebase data
const chats: Chat[] = [
  { 
    id: '1', 
    participants: ['user1', 'user2'],
    messages: [
        { id: 'm1', senderId: 'user2', content: 'See you tomorrow!', timestamp: '10:42 AM', type: 'text' }
    ],
    unreadCount: 2,
    // Add participantDetails for rendering
    participantDetails: {
        id: 'user2',
        name: 'Ayesha Khan',
        avatar: 'https://picsum.photos/seed/1/40/40',
        online: true
    }
  },
  { 
    id: '2', 
    participants: ['user1', 'user3'],
    messages: [
        { id: 'm2', senderId: 'user3', content: 'Haha, that\'s funny.', timestamp: '9:30 AM', type: 'text' }
    ],
    unreadCount: 0,
    participantDetails: {
        id: 'user3',
        name: 'Bilal Ahmed',
        avatar: 'https://picsum.photos/seed/2/40/40',
        online: false
    }
  },
  { 
    id: '3', 
    participants: ['user1', 'user4'],
    messages: [
        { id: 'm3', senderId: 'user4', content: 'Okay, sounds good.', timestamp: 'Yesterday', type: 'text' }
    ],
    unreadCount: 0,
    participantDetails: {
        id: 'user4',
        name: 'Fatima Ali',
        avatar: 'https://picsum.photos/seed/3/40/40',
        online: true
    }
   },
  { 
    id: '4', 
    participants: ['user1', 'user5'],
    messages: [
        { id: 'm4', senderId: 'user1', content: 'You sent an attachment.', timestamp: 'Yesterday', type: 'text' }
    ],
    unreadCount: 0,
    participantDetails: {
        id: 'user5',
        name: 'Zainab Omar',
        avatar: 'https://picsum.photos/seed/4/40/40',
        online: false
    }
  },
];


export default function ChatPage() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

  return (
    <div className="flex h-screen bg-background">
      <div className="w-full max-w-sm border-r">
        <div className="p-4 space-y-4">
          <h1 className="text-2xl font-bold">Chats</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-9" />
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="flex flex-col">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 ${selectedChat?.id === chat.id ? 'bg-muted/50' : ''}`}
                onClick={() => setSelectedChat(chat)}
              >
                <Avatar>
                  <AvatarImage src={chat.participantDetails?.avatar} />
                  <AvatarFallback>{getInitials(chat.participantDetails?.name ?? '')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{chat.participantDetails?.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{chat.messages[chat.messages.length - 1].content}</p>
                </div>
                <div className="flex flex-col items-end text-xs text-muted-foreground">
                  <span>{chat.messages[chat.messages.length - 1].timestamp}</span>
                  {chat.unreadCount > 0 && (
                    <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <ChatDetail chat={selectedChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
