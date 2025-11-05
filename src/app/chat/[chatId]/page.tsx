'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChatDetail } from '@/components/chat/chat-detail';
import type { Chat } from '@/lib/types';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// This is mock data. In a real app, you'd fetch this based on the chatId.
const chats: Chat[] = [
  { 
    id: '1', 
    participants: ['user1', 'user2'],
    messages: [
        { id: 'm1', senderId: 'user2', content: 'See you tomorrow!', timestamp: '10:42 AM', type: 'text' }
    ],
    unreadCount: 2,
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


export default function ChatIdPage({ params: paramsProp }: { params: { chatId: string } }) {
  const router = useRouter();
  // params is a promise in the app router. We need to resolve it.
  const params = React.use(paramsProp as any);
  const chat = chats.find(c => c.id === params.chatId);

  if (!chat) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-lg">Chat not found.</p>
        <Button variant="link" onClick={() => router.push('/chat')}>
          Go back to chats
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
       <div className="md:hidden p-2 border-b">
         <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
       </div>
      <ChatDetail chat={chat} />
    </div>
  );
}
