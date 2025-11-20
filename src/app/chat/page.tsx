'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Settings,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import type { Chat as ChatType, UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { applyNameColor } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';


interface ChatWithParticipant extends ChatType {
    otherParticipant: UserProfile | null;
}

function ChatListPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [chats, setChats] = useState<ChatWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const chatsRef = collection(firestore, 'chats');
    const q = query(
      chatsRef,
      where('members', 'array-contains', user.uid),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const chatsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatType));

        const otherUserIds = chatsData.map(chat => chat.members.find(id => id !== user.uid)).filter(Boolean) as string[];

        let usersMap: Map<string, UserProfile> = new Map();

        if (otherUserIds.length > 0) {
            // Firestore 'in' query can take up to 30 elements. Chunking for safety.
            const chunks = [];
            for (let i = 0; i < otherUserIds.length; i += 30) {
                chunks.push(otherUserIds.slice(i, i + 30));
            }
            
            for (const chunk of chunks) {
                const usersQuery = query(collection(firestore, 'users'), where('uid', 'in', chunk));
                const usersSnapshot = await getDocs(usersQuery);
                usersSnapshot.forEach(doc => {
                    usersMap.set(doc.id, doc.data() as UserProfile);
                });
            }
        }
        
        const populatedChats = chatsData.map(chat => {
            const otherUserId = chat.members.find(id => id !== user.uid);
            const otherParticipant = otherUserId ? usersMap.get(otherUserId) ?? null : null;
            return { ...chat, otherParticipant };
        });

        setChats(populatedChats);
        setLoading(false);
      },
      (error) => {
        console.error(`Error fetching chats for user ${user.uid}:`, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, firestore]);

  const getInitials = (name: string) =>
    name ? name.split(' ').map((n) => n[0]).join('') : 'U';

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      if (isToday(date)) {
        return format(date, 'p'); // e.g., 5:30 PM
      }
      if (isYesterday(date)) {
        return 'Yesterday';
      }
      return format(date, 'MM/dd/yy');
    } catch (e) {
      // Fallback for string or number timestamps
      try {
        const date = new Date(timestamp);
        if (isToday(date)) return format(date, 'p');
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'MM/dd/yy');
      } catch (e2) {
        return '';
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-12 w-12 rounded-full bg-muted"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-muted"></div>
              <div className="h-3 w-3/4 rounded bg-muted"></div>
            </div>
            <div className="h-4 w-1/4 rounded bg-muted"></div>
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold">No Chats Yet</h2>
            <p className="text-muted-foreground mt-2">
                Go to the Friends tab to start a new conversation.
            </p>
        </div>
    );
  }

  return (
    <div className="divide-y">
      {chats.map((chat) => {
        const otherParticipant = chat.otherParticipant;
        const unreadCount = chat.unreadCount?.[user!.uid] ?? 0;
        
        if (!otherParticipant) return null; // Don't render chat if participant data is missing

        return (
          <Link
            href={`/chat/${otherParticipant.uid}`}
            key={chat.id}
            className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={otherParticipant.photoURL} />
                <AvatarFallback>
                  {getInitials(otherParticipant.displayName)}
                </AvatarFallback>
              </Avatar>
               {otherParticipant.officialBadge?.isOfficial && (
                  <div className="absolute bottom-0 right-0">
                      <OfficialBadge color={otherParticipant.officialBadge.badgeColor} size="icon" className="h-5 w-5" isOwner={otherParticipant.canManageOfficials} />
                  </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2">
                     <p className="font-semibold truncate">
                        {applyNameColor(otherParticipant.displayName, otherParticipant.nameColor)}
                    </p>
                    {otherParticipant.verifiedBadge?.showBadge && (
                        <VerifiedBadge color={otherParticipant.verifiedBadge.badgeColor} />
                    )}
                </div>
              <p className={cn("text-sm truncate", unreadCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>
                {chat.lastMessage?.content || 'No messages yet...'}
              </p>
            </div>
            <div className="flex flex-col items-end text-xs space-y-1">
              <p className={cn("text-muted-foreground", unreadCount > 0 && "text-primary font-bold")}>
                {formatTimestamp(chat.lastMessage?.timestamp)}
              </p>
              {unreadCount > 0 && (
                <Badge variant="default" className="h-5 w-5 justify-center p-0">{unreadCount}</Badge>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}


export default function ChatMainPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    if (!user || !firestore) return;

    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
    });
    
    return () => {
        unsubscribeNotifications();
    };

  }, [user, firestore]);


  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/95 z-10">
        <h1 className="text-2xl font-bold text-primary">Love Chat</h1>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" asChild>
                <Link href="/chat/friends?search=true">
                    <Search className="h-5 w-5" />
                </Link>
            </Button>
             <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full" asChild>
                <Link href="/chat/notifications">
                  <Bell className="h-5 w-5" />
                  {unreadNotificationCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadNotificationCount}</Badge>
                  )}
                  <span className="sr-only">Notifications</span>
                </Link>
             </Button>
             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" asChild>
                <Link href="/settings">
                    <Settings className="h-5 w-5" />
                </Link>
             </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <ChatListPage />
      </div>
    </div>
  );
}
