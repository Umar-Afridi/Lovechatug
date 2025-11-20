'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Settings, Bell, Archive } from 'lucide-react';
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
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import type { Chat as ChatType, UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { applyNameColor } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { useToast } from '@/hooks/use-toast';

interface ChatWithParticipant extends ChatType {
  otherParticipant: UserProfile | null;
}

function ChatListPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [chats, setChats] = useState<ChatWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [longPressedChatId, setLongPressedChatId] = useState<string | null>(
    null
  );
  const { toast } = useToast();
  const longPressTimer = React.useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user || !firestore) return;

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubProfile = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data() as UserProfile);
      }
    });

    return () => unsubProfile();
  }, [user, firestore]);

  useEffect(() => {
    if (!user || !firestore || !userProfile) {
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

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const chatsData = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as ChatType)
        );

        // Filter out archived chats on the client
        const archivedChatIds = userProfile?.archivedChats || [];
        const visibleChats = chatsData.filter(
          (chat) => !archivedChatIds.includes(chat.id)
        );

        const otherUserIds = visibleChats
          .map((chat) => chat.members.find((id) => id !== user.uid))
          .filter(Boolean) as string[];

        let usersMap: Map<string, UserProfile> = new Map();

        if (otherUserIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < otherUserIds.length; i += 30) {
            chunks.push(otherUserIds.slice(i, i + 30));
          }

          for (const chunk of chunks) {
            const usersQuery = query(
              collection(firestore, 'users'),
              where('uid', 'in', chunk)
            );
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach((doc) => {
              usersMap.set(doc.data().uid, doc.data() as UserProfile);
            });
          }
        }

        const populatedChats = visibleChats.map((chat) => {
          const otherUserId = chat.members.find((id) => id !== user.uid);
          const otherParticipant = otherUserId
            ? usersMap.get(otherUserId) ?? null
            : null;
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
  }, [user, firestore, userProfile]);

  const handleArchiveChat = async (chatId: string) => {
    if (!user || !firestore) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        archivedChats: arrayUnion(chatId),
      });
      toast({
        title: 'Chat Archived',
      });
      setLongPressedChatId(null);
    } catch (error) {
      console.error('Error archiving chat:', error);
      toast({
        title: 'Error',
        description: 'Could not archive chat.',
        variant: 'destructive',
      });
    }
  };

  const handlePointerDown = (chatId: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressedChatId(chatId);
    }, 500); // 500ms for long press
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

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
    <div
      className="divide-y h-full overflow-y-auto"
      onClick={() => {
        if (longPressedChatId) setLongPressedChatId(null);
      }}
    >
      {chats.map((chat) => {
        const otherParticipant = chat.otherParticipant;
        const unreadCount = chat.unreadCount?.[user!.uid] ?? 0;
        const isLongPressed = longPressedChatId === chat.id;

        if (!otherParticipant) return null;

        return (
          <div
            key={chat.id}
            onPointerDown={() => handlePointerDown(chat.id)}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchEnd={handlePointerUp}
            className={cn(
              'relative transition-colors',
              isLongPressed && 'bg-primary/10'
            )}
          >
            <Link
              href={isLongPressed ? '#' : `/chat/${otherParticipant.uid}`}
              className={cn(
                'flex items-center gap-4 p-4 transition-transform duration-200',
                isLongPressed && 'translate-x-12'
              )}
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
                    <OfficialBadge
                      color={otherParticipant.officialBadge.badgeColor}
                      size="icon"
                      className="h-5 w-5"
                      isOwner={otherParticipant.canManageOfficials}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">
                    {applyNameColor(
                      otherParticipant.displayName,
                      otherParticipant.nameColor
                    )}
                  </p>
                  {otherParticipant.verifiedBadge?.showBadge && (
                    <VerifiedBadge
                      color={otherParticipant.verifiedBadge.badgeColor}
                    />
                  )}
                </div>
                <p
                  className={cn(
                    'text-sm truncate',
                    unreadCount > 0
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground'
                  )}
                >
                  {chat.lastMessage?.content || 'No messages yet...'}
                </p>
              </div>
              <div className="flex flex-col items-end text-xs space-y-1">
                <p
                  className={cn(
                    'text-muted-foreground',
                    unreadCount > 0 && 'text-primary font-bold'
                  )}
                >
                  {formatTimestamp(chat.lastMessage?.timestamp)}
                </p>
                {unreadCount > 0 && (
                  <Badge
                    variant="default"
                    className="h-5 w-5 justify-center p-0"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </div>
            </Link>

            {isLongPressed && (
              <div className="absolute left-0 top-0 h-full flex items-center pl-3">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveChat(chat.id);
                  }}
                >
                  <Archive className="h-5 w-5 text-primary" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function InboxPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    if (!user || !firestore) return;

    const notificationsRef = collection(
      firestore,
      'users',
      user.uid,
      'notifications'
    );
    const qNotifications = query(
      notificationsRef,
      where('isRead', '==', false)
    );
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
      setUnreadNotificationCount(snapshot.size);
    });

    return () => {
      unsubscribeNotifications();
    };
  }, [user, firestore]);

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/95 z-10">
        <h1 className="text-2xl font-bold text-primary">Love Chat</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            asChild
          >
            <Link href="/chat/friends?search=true">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full"
            asChild
          >
            <Link href="/chat/notifications">
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0"
                >
                  {unreadNotificationCount}
                </Badge>
              )}
              <span className="sr-only">Notifications</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            asChild
          >
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
