'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mic,
  MicOff,
  User,
  Crown,
  Shield,
  MoreVertical,
  UserX,
  LogOut,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


// Mock data - in a real app, this would come from Firestore
const mockRoom = {
  name: "Friends Hangout",
  owner: { id: 'user1', name: 'Umar Afridi', avatarUrl: 'https://github.com/shadcn.png' },
  superAdmin: { id: 'user2', name: 'Super Admin', avatarUrl: '' },
};

const mockMembers = [
    { id: 'user3', name: 'Ali', avatarUrl: '', isMuted: true },
    { id: 'user4', name: 'Zain', avatarUrl: 'https://github.com/shadcn.png', isMuted: false },
    null, null, // Empty slots
    { id: 'user5', name: 'Ahmed', avatarUrl: '', isMuted: false },
    null, null, null // Empty slots
];

const MicPlaceholder = () => (
    <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center">
        <Mic className="w-8 h-8 text-muted-foreground/50" />
    </div>
);

const UserMic = ({ user, role, isOwner }: { user: { id: string, name: string, avatarUrl: string, isMuted?: boolean } | null, role?: 'owner' | 'super' | 'member', isOwner: boolean }) => {
    if (!user) {
        return (
            <div className="flex flex-col items-center gap-2 text-center">
                <MicPlaceholder />
                <Button size="sm" variant="outline">Sit</Button>
            </div>
        )
    }
    
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!isOwner || user.id === mockRoom.owner.id}>
                 <div className="flex flex-col items-center gap-2 text-center cursor-pointer">
                    <div className="relative">
                        <Avatar className="w-20 h-20 border-2 border-primary">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback className="text-2xl">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        {user.isMuted && (
                            <div className="absolute bottom-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1">
                                <MicOff className="w-3 h-3" />
                            </div>
                        )}
                        {role === 'owner' && (
                             <div className="absolute top-0 right-0 bg-yellow-500 text-white rounded-full p-1">
                                <Crown className="w-3 h-3" />
                            </div>
                        )}
                        {role === 'super' && (
                             <div className="absolute top-0 right-0 bg-blue-500 text-white rounded-full p-1">
                                <Shield className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                    <p className="font-semibold text-sm truncate w-24">{user.name}</p>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>
                    <Volume2 className="mr-2 h-4 w-4" />
                    <span>Adjust Volume</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <UserX className="mr-2 h-4 w-4" />
                    <span>Kick User</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500 focus:text-red-500">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Remove from Mic</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


export default function RoomPage({ params }: { params: { roomId: string } }) {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center justify-between gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold">{mockRoom.name}</h1>
            </div>
             <Button variant="destructive" size="sm" onClick={() => router.push('/chat/rooms')}>
                <LogOut className="mr-2 h-4 w-4"/> Leave
            </Button>
        </header>
        
        <ScrollArea className="flex-1">
             <div className="p-4 md:p-6 space-y-8">
                {/* Owner & Super Admin Mics */}
                <div className="grid grid-cols-2 gap-4 md:gap-8">
                    <UserMic user={mockRoom.owner} role="owner" isOwner={true} />
                    <UserMic user={mockRoom.superAdmin} role="super" isOwner={true} />
                </div>
                
                {/* Separator */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                        Audience
                        </span>
                    </div>
                </div>

                {/* User Mics */}
                <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <UserMic key={i} user={mockMembers[i] || null} role="member" isOwner={true} />
                    ))}
                </div>
            </div>
        </ScrollArea>
    </div>
  );
}
