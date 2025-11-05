'use client';
import type { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Info, Phone, Video, MoreVertical } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';
import { cn } from '@/lib/utils';

interface ChatTopbarProps {
    chatPartner: User;
}

export function ChatTopbar({ chatPartner }: ChatTopbarProps) {
    return (
        <div className="flex h-16 items-center justify-between border-b p-4 bg-card">
            <div className="flex items-center gap-3">
                <SidebarTrigger className="md:hidden" />
                <Avatar>
                    <AvatarImage src={chatPartner.avatar} alt={chatPartner.name} />
                    <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-semibold font-headline">{chatPartner.name}</span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("h-2 w-2 rounded-full", chatPartner.online ? 'bg-green-500' : 'bg-gray-400')} />
                        {chatPartner.online ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost">
                    <Phone className="h-5 w-5" />
                    <span className="sr-only">Call</span>
                </Button>
                <Button size="icon" variant="ghost">
                    <Video className="h-5 w-5" />
                    <span className="sr-only">Video Call</span>
                </Button>
                <Button size="icon" variant="ghost">
                    <Info className="h-5 w-5" />
                    <span className="sr-only">Information</span>
                </Button>
                 <Button size="icon" variant="ghost">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">More options</span>
                </Button>
            </div>
        </div>
    );
}
