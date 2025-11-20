'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  UserPlus,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  Chat,
  UserProfile,
  FriendRequest as FriendRequestType,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn, applyNameColor } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import {
  collection,
  onSnapshot,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  format,
  isToday,
  isYesterday,
  differenceInMinutes,
} from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { useSound } from '@/hooks/use-sound';
import { useRouter } from 'next/navigation';

// This component is self-contained and fetches its own data efficiently.
const ChatListItem = ({
  chat,
  participant,
  currentUserId,
}: {
  chat: Chat;
  participant: UserProfile;
  currentUserId: string;
}) => {
  const getInitials = (name: string) =>
    name ? name.split(' ').map((n) => n[0]).join('') : 'U';

  const unreadCount = chat.unreadCount?.[currentUserId] ?? 0;

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    if (differenceInMinutes(now, date) < 1) {
      return 'Just now';
    }
    if (isToday(date)) {
      return format(date, 'p'); // e.g., 10:30 PM
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'P'); // e.g., 07/16/2024
  };

  const participantId = participant.uid;
  const isTyping = React.useMemo(
    () => chat.typing?.[participantId || ''] === true,
    [chat.typing, participantId]
  );

  return (
    <Link href={`/chat/${participantId}`} key={chat.id}>
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50">
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={participant.photoURL || undefined} />
            <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
          </Avatar>
          {participant.officialBadge?.isOfficial && (
            <div className="absolute bottom-0 right-0">
              <OfficialBadge
                color={participant.officialBadge.badgeColor}
                size="icon"
                className="h-4 w-4"
                isOwner={participant.canManageOfficials}
              />
            </div>
          )}
          {participant.isOnline && (
            <div
              className={cn(
                'absolute bottom-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background',
                participant.officialBadge?.isOfficial ? 'left-0' : 'right-0'
              )}
            ></div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">
              {applyNameColor(
                participant.displayName,
                participant.nameColor
              )}
            </p>
            {participant.verifiedBadge?.showBadge && (
              <VerifiedBadge color={participant.verifiedBadge.badgeColor} />
            )}
          </div>
          <p
            className={cn(
              'text-sm  truncate',
              isTyping ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {isTyping ? 'typing...' : chat.lastMessage?.content ?? 'No messages yet'}
          </p>
        </div>
        <div className="flex flex-col items-end text-xs text-muted-foreground">
          <span>{formatTimestamp(chat.lastMessage?.timestamp)}</span>
          {unreadCount > 0 && <Badge className="mt-1">{unreadCount}</Badge>}
        </div>
      </div>
    </Link>
  );
};

interface PopulatedChat extends Chat {
  participant: UserProfile;
}

export default function ChatListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [populatedChats, setPopulatedChats] = useState<PopulatedChat[]>([]);

  // Effect to fetch chats and participant data efficiently
  useEffect(() => {
    if (!user || !firestore) {
      setLoading(false);
      setPopulatedChats([]);
      return;
    }

    setLoading(true);
    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(
      chatsRef,
      where('members', 'array-contains', user.uid),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const unsubChats = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const chatsData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Chat)
        );

        if (chatsData.length === 0) {
          setPopulatedChats([]);
          setLoading(false);
          return;
        }

        const participantIds = [
          ...new Set(
            chatsData.flatMap((chat) =>
              chat.members.filter((id) => id !== user.uid)
            )
          ),
        ];

        const usersData = new Map<string, UserProfile>();

        // Batch fetch user profiles
        if (participantIds.length > 0) {
          for (let i = 0; i < participantIds.length; i += 10) {
            const chunk = participantIds.slice(i, i + 10);
            if (chunk.length > 0) {
              const usersQuery = query(
                collection(firestore, 'users'),
                where('uid', 'in', chunk)
              );
              const usersSnapshot = await getDocs(usersQuery);
              usersSnapshot.forEach((doc) =>
                usersData.set(doc.id, doc.data() as UserProfile)
              );
            }
          }
        }

        const populated = chatsData
          .map((chat) => {
            const participantId = chat.members.find((id) => id !== user.uid);
            const participant = participantId
              ? usersData.get(participantId)
              : undefined;
            return { ...chat, participant };
          })
          .filter((c) => c.participant) as PopulatedChat[];

        setPopulatedChats(populated);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching chats:', error);
        setLoading(false);
      }
    );

    return () => unsubChats();
  }, [user, firestore]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading chats...
      </div>
    );
  }

  if (populatedChats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-center p-8 text-muted-foreground">
        <div>
          <p className="font-semibold text-lg">No chats yet</p>
          <p>Find friends to start a conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col">
        {populatedChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            participant={chat.participant}
            currentUserId={user.uid}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
