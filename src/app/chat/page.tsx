'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, Users, UserPlus, Phone, Heart, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Chat } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GroupsPage from './groups/page';
import FriendsPage from './friends/page';
import CallsPage from './calls/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { User as FirebaseUserType } from 'firebase/auth';


// Mock data, will be replaced with Firebase data
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

const navigationItems = [
    { name: 'Chats', icon: MessageSquare, content: 'chats' },
    { name: 'Groups', icon: Users, content: 'groups' },
    { name: 'Requests', icon: UserPlus, content: 'requests' },
    { name: 'Calls', icon: Phone, content: 'calls' },
];

const ChatList = () => {
    const router = useRouter();
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

    return (
        <ScrollArea className="h-[calc(100vh-172px)]">
          <div className="flex flex-col">
            {chats.map(chat => (
              <Link href={`/chat/${chat.id}`} key={chat.id} passHref>
                <div 
                  className='flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50'
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
              </Link>
            ))}
          </div>
        </ScrollArea>
    );
};


export default function ChatPage() {
  const [activeTab, setActiveTab] = useState('chats');
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const handleSearch = async () => {
      if (searchQuery.trim() === '') {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      if (firestore && user) {
        const usersRef = collection(firestore, 'users');
        // Search by displayName or username, ensuring we don't return the current user
        const q = query(usersRef, where('displayName', '>=', searchQuery), where('displayName', '<=', searchQuery + '\uf8ff'));
        // const qUsername = query(usersRef, where('username', '>=', searchQuery), where('username', '<=', searchQuery + '\uf8ff'));

        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(u => u.id !== user.uid); // Exclude self
        setSearchResults(users);
      }
      setIsSearching(false);
    };

    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 500); // Debounce search to avoid too many queries

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, firestore, user]);

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const renderContent = () => {
    if (searchResults.length > 0) {
      return (
        <ScrollArea className="h-[calc(100vh-172px)]">
          {searchResults.map(foundUser => (
            <div key={foundUser.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={foundUser.photoURL} />
                  <AvatarFallback>{getInitials(foundUser.displayName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{foundUser.displayName}</p>
                  <p className="text-sm text-muted-foreground">@{foundUser.username}</p>
                </div>
              </div>
              <Button size="sm">Add Request</Button>
            </div>
          ))}
        </ScrollArea>
      );
    }
    
    if (searchQuery.length > 0 && !isSearching) {
       return (
         <div className="flex h-[calc(100vh-172px)] items-center justify-center text-muted-foreground">
           <p>No users found.</p>
         </div>
       );
    }
    
    switch (activeTab) {
        case 'chats':
            return <ChatList />;
        case 'groups':
            return <GroupsPage />;
        case 'requests':
            return <FriendsPage />;
        case 'calls':
            return <CallsPage />;
        default:
            return <ChatList />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="w-full border-r">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
                <Heart className="text-red-500 animate-pulse" fill="red"/>
                <span>LoveChat</span>
                <Heart className="text-red-500 animate-pulse" fill="red"/>
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                        src={user?.photoURL ?? undefined}
                        alt={user?.displayName ?? 'user-avatar'}
                    />
                    <AvatarFallback>
                        {getInitials(user?.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.displayName ?? 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email ?? 'No email'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search users..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {!searchQuery && (
          <div className='flex justify-around border-b'>
              {navigationItems.map((item) => (
                  <Button 
                      key={item.name}
                      variant="ghost" 
                      className={cn(
                          "flex-1 justify-center gap-2 rounded-none",
                          activeTab === item.content ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
                      )}
                      onClick={() => setActiveTab(item.content)}
                  >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                  </Button>
              ))}
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  );
}
