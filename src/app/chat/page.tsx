'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock data, will be replaced with Firebase data
const chats = [
  { id: '1', name: 'Ayesha Khan', message: 'See you tomorrow!', time: '10:42 AM', unread: 2, avatar: '/avatars/01.png' },
  { id: '2', name: 'Bilal Ahmed', message: 'Haha, that\'s funny.', time: '9:30 AM', avatar: '/avatars/02.png' },
  { id: '3', name: 'Fatima Ali', message: 'Okay, sounds good.', time: 'Yesterday', avatar: '/avatars/03.png' },
  { id: '4', name: 'Zainab Omar', message: 'You sent an attachment.', time: 'Yesterday', avatar: '/avatars/04.png' },
];


export default function ChatPage() {
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
              <div key={chat.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer">
                <Avatar>
                  <AvatarImage src={`https://picsum.photos/seed/${chat.id}/40/40`} />
                  <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{chat.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{chat.message}</p>
                </div>
                <div className="flex flex-col items-end text-xs text-muted-foreground">
                  <span>{chat.time}</span>
                  {chat.unread > 0 && (
                    <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Select a chat to start messaging</p>
      </div>
    </div>
  );
}
