import type { Chat } from '@/lib/types';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getChatPartner } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface ChatListProps {
  chats: Chat[];
}

export function ChatList({ chats }: ChatListProps) {
  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
       <div className="p-4 border-b">
         <h2 className="text-2xl font-bold font-headline">Roshan Chat</h2>
         <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-9" />
         </div>
       </div>
       <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {chats.map((chat) => {
            const partner = getChatPartner(chat);
            if (!partner) return null;

            const lastMessage = chat.messages[chat.messages.length - 1];
            return (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={partner.avatar} alt={partner.name} />
                  <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate">
                  <div className="font-semibold font-headline">{partner.name}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    {lastMessage.content}
                  </p>
                </div>
                <div className="flex flex-col items-end text-xs text-muted-foreground">
                  <span>{lastMessage.timestamp}</span>
                  {chat.unreadCount > 0 && (
                    <Badge className="mt-1">{chat.unreadCount}</Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
       </ScrollArea>
    </div>
  );
}
