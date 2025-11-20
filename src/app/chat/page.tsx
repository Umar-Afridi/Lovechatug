'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, Settings, X, UserPlus, Check, MessageSquare, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Chat, UserProfile, FriendRequest as FriendRequestType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn, applyNameColor } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { collection, onSnapshot, doc, query, where, getDocs, orderBy, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { useSound } from '@/hooks/use-sound';

// This component is self-contained and fetches its own data efficiently.
const ChatListItem = ({ chat, participant, currentUserId }: { chat: Chat, participant: UserProfile, currentUserId: string }) => {
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';
    
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
    const isTyping = useMemo(() => chat.typing?.[participantId || ''] === true, [chat.typing, participantId]);
    
    return (
      <Link href={`/chat/${participantId}`} key={chat.id}>
        <div className='flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50'>
          <div className="relative">
            <Avatar className="h-12 w-12">
                <AvatarImage src={participant.photoURL || undefined} />
                <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
            </Avatar>
            {participant.officialBadge?.isOfficial && (
              <div className="absolute bottom-0 right-0">
                  <OfficialBadge color={participant.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={participant.canManageOfficials} />
              </div>
            )}
            {participant.isOnline && (
                <div className={cn(
                    "absolute bottom-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background",
                    participant.officialBadge?.isOfficial ? "left-0" : "right-0"
                )}></div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
                <p className="font-semibold truncate">
                  {applyNameColor(participant.displayName, participant.nameColor)}
                </p>
                {participant.verifiedBadge?.showBadge && (
                    <VerifiedBadge color={participant.verifiedBadge.badgeColor} />
                )}
            </div>
            <p className={cn("text-sm  truncate", isTyping ? "text-primary" : "text-muted-foreground")}>
                {isTyping ? "typing..." : (chat.lastMessage?.content ?? 'No messages yet')}
            </p>
          </div>
          <div className="flex flex-col items-end text-xs text-muted-foreground">
            <span>{formatTimestamp(chat.lastMessage?.timestamp)}</span>
            {unreadCount > 0 && (
                <Badge className="mt-1">{unreadCount}</Badge>
            )}
          </div>
        </div>
      </Link>
    );
};

interface PopulatedChat extends Chat {
    participant: UserProfile;
}

export default function ChatPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [populatedChats, setPopulatedChats] = useState<PopulatedChat[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestType[]>([]);
  const { toast } = useToast();
  const { play: playSendRequestSound } = useSound('https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/sound/short_click.mp3');
  const router = useRouter();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };
  
  // Effect to fetch the current user's profile
  useEffect(() => {
    if (!user || !firestore) return;
    const unsub = onSnapshot(doc(firestore, 'users', user.uid), (doc) => {
        if(doc.exists()) {
            setProfile(doc.data() as UserProfile);
        }
    });
    return () => unsub();
  }, [user, firestore]);

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

    const unsubChats = onSnapshot(chatsQuery, async (snapshot) => {
        const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        
        if (chatsData.length === 0) {
            setPopulatedChats([]);
            setLoading(false);
            return;
        }

        const participantIds = [...new Set(
            chatsData.flatMap(chat => chat.members.filter(id => id !== user.uid))
        )];

        const usersData = new Map<string, UserProfile>();
        
        // Batch fetch user profiles
        if (participantIds.length > 0) {
            for (let i = 0; i < participantIds.length; i += 10) {
                const chunk = participantIds.slice(i, i + 10);
                if (chunk.length > 0) {
                    const usersQuery = query(collection(firestore, 'users'), where('uid', 'in', chunk));
                    const usersSnapshot = await getDocs(usersQuery);
                    usersSnapshot.forEach(doc => usersData.set(doc.id, doc.data() as UserProfile));
                }
            }
        }
        
        const populated = chatsData.map(chat => {
            const participantId = chat.members.find(id => id !== user.uid);
            const participant = participantId ? usersData.get(participantId) : undefined;
            return { ...chat, participant };
        }).filter(c => c.participant) as PopulatedChat[];

        setPopulatedChats(populated);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching chats:", error);
        setLoading(false);
    });

    return () => unsubChats();

  }, [user, firestore]);


  // Effect for notifications and sent friend requests (can stay as is)
  useEffect(() => {
    if (!user || !firestore) return;

    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
    });

    const sentRequestsRef = collection(firestore, 'friendRequests');
    const qSent = query(sentRequestsRef, where('senderId', '==', user.uid), where('status', '==', 'pending'));
    const unsubSent = onSnapshot(qSent, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequestType));
        setSentRequests(requests);
    });

    return () => {
        unsubNotifications();
        unsubSent();
    };
  }, [user, firestore]);

 const handleSearch = async (queryText: string) => {
      setSearchQuery(queryText);
      const queryLower = queryText.toLowerCase().trim();

      if (queryLower.length < 2) {
        setSearchResults([]);
        return;
      }

      if (firestore && user && profile) {
        const usersRef = collection(firestore, 'users');
        const usernameQuery = query(
          usersRef, 
          where('username', '>=', queryLower),
          where('username', '<=', queryLower + '\uf8ff')
        );
        
        try {
          const usernameSnapshot = await getDocs(usernameQuery);
          const resultsMap = new Map<string, UserProfile>();

          usernameSnapshot.forEach((doc: any) => {
              const userData = doc.data() as UserProfile;
              if (userData.username.toLowerCase().startsWith(queryLower)) {
                 resultsMap.set(userData.uid, userData);
              }
          });
            
          const myBlockedList = profile.blockedUsers || [];
          const whoBlockedMe = profile.blockedBy || [];

          const finalResults = Array.from(resultsMap.values()).filter(u => 
                u.uid !== user.uid &&
                !u.isDisabled &&
                !myBlockedList.includes(u.uid) &&
                !whoBlockedMe.includes(u.uid)
          );

          setSearchResults(finalResults);
        } catch (serverError) {
            console.error("Error searching users:", serverError);
            toast({
                variant: 'destructive',
                title: 'Search Failed',
                description: 'Could not perform search due to a server error.'
            })
        }
      }
    };

    const handleSendRequest = async (receiverId: string) => {
      if (!firestore || !user) return;
      const requestsRef = collection(firestore, 'friendRequests');
      const newRequest = {
          senderId: user.uid,
          receiverId: receiverId,
          status: 'pending' as const,
          createdAt: serverTimestamp(),
      };
      
      try {
          await addDoc(requestsRef, newRequest);
          playSendRequestSound();
          toast({ title: 'Request Sent', description: 'Your friend request has been sent.'});
      } catch (error) {
          console.error("Error sending friend request:", error);
          toast({ title: 'Error', description: 'Could not send friend request.', variant: 'destructive'});
      }
  };
  
  const handleCancelRequest = async (receiverId: string) => {
      if (!firestore || !user) return;
      
      const q = query(
        collection(firestore, "friendRequests"),
        where("senderId", "==", user.uid),
        where("receiverId", "==", receiverId)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docToDelete = querySnapshot.docs[0];
        try {
            await deleteDoc(docToDelete.ref);
            toast({ title: 'Request Cancelled' });
        } catch(error) {
            console.error("Error cancelling friend request:", error);
            toast({ title: 'Error', description: 'Could not cancel friend request.', variant: 'destructive'});
        }
      }
  };
    
  const renderContent = () => {
    if (isSearching) {
      return (
        <ScrollArea className="flex-1">
          {searchResults.length === 0 && searchQuery ? (
            <div className="p-4 text-center text-muted-foreground">
              <p>No users found for "{searchQuery}".</p>
            </div>
          ) : (
            searchResults.map((foundUser) => {
              const isFriend = profile?.friends?.includes(foundUser.uid);
              const hasSentRequest = sentRequests.some(
                (req) => req.receiverId === foundUser.uid
              );

              return (
                <div
                  key={foundUser.uid}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={foundUser.photoURL || undefined} />
                        <AvatarFallback>
                          {getInitials(foundUser.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      {foundUser.officialBadge?.isOfficial && (
                        <div className="absolute bottom-0 right-0">
                          <OfficialBadge
                            color={foundUser.officialBadge.badgeColor}
                            size="icon"
                            className="h-4 w-4"
                            isOwner={foundUser.canManageOfficials}
                          />
                        </div>
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">
                          {applyNameColor(
                            foundUser.displayName,
                            foundUser.nameColor
                          )}
                        </p>
                        {foundUser.verifiedBadge?.showBadge && (
                          <VerifiedBadge
                            color={foundUser.verifiedBadge.badgeColor}
                          />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        @{foundUser.username}
                      </p>
                    </div>
                  </div>

                  {isFriend ? (
                     <Button size="sm" variant="secondary" onClick={() => router.push(`/chat/${foundUser.uid}`)}>
                        <MessageSquare className="mr-2 h-4 w-4"/>
                        Message
                    </Button>
                  ) : hasSentRequest ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelRequest(foundUser.uid)}
                    >
                      <Clock className="mr-2 h-4 w-4"/>
                      Sent
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleSendRequest(foundUser.uid)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </ScrollArea>
      );
    }

    if (loading || !user) {
        return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading chats...</div>;
    }
    
    if (populatedChats.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-center p-8 text-muted-foreground">
           <div>
            <p className="font-semibold text-lg">No chats yet</p>
            <p>Find friends to start a conversation!</p>
           </div>
        </div>
      )
    }

    return (
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {populatedChats.map(chat => (
              <ChatListItem key={chat.id} chat={chat} participant={chat.participant} currentUserId={user.uid} />
            ))}
          </div>
        </ScrollArea>
    );
  }
  
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="w-full border-r flex flex-col h-full">
        {/* Header */}
        <div className="p-4 space-y-4 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
                <span>Love Chat</span>
            </h1>
            <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setIsSearching(prev => !prev)}>
                      <Search className="h-5 w-5" />
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
                        <span className="sr-only">Settings</span>
                    </Link>
                 </Button>
            </div>
          </div>
           {isSearching && (
             <div className="relative">
                <Input 
                    placeholder="Search by username..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => { setIsSearching(false); setSearchQuery(''); setSearchResults([]); }}>
                    <X className="h-5 w-5" />
                </Button>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderContent()}
        </div>

      </div>
    </div>
  );
}
