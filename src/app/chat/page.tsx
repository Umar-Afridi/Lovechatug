'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Search, Bell, Settings, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Chat, UserProfile, FriendRequest as FriendRequestType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { collection, onSnapshot, doc, query, where, getDocs, updateDoc, addDoc, deleteDoc, serverTimestamp, orderBy, writeBatch, or } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';

function applyNameColor(name: string, color?: UserProfile['nameColor']) {
    if (!color || color === 'default') {
        return name;
    }
    if (color === 'gradient') {
        return <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate">{name}</span>;
    }
    
    const colorClasses: Record<Exclude<NonNullable<UserProfile['nameColor']>, 'default' | 'gradient'>, string> = {
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };

    return <span className={cn('font-bold', colorClasses[color])}>{name}</span>;
}

const ChatListItem = ({ chat, currentUserId }: { chat: Chat, currentUserId: string }) => {
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';
    const firestore = useFirestore();
    const [participant, setParticipant] = useState<UserProfile | null>(null);
    
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

    const participantId = useMemo(() => chat.members.find(id => id !== currentUserId), [chat.members, currentUserId]);
    const isTyping = useMemo(() => chat.typing?.[participantId || ''] === true, [chat.typing, participantId]);
    
    useEffect(() => {
        if (!firestore || !participantId) return;

        const prefilledDetails = chat.participantDetails?.[participantId];
        if (prefilledDetails?.displayName) {
             setParticipant({
                uid: participantId,
                displayName: prefilledDetails.displayName,
                photoURL: prefilledDetails.photoURL,
                email: '',
                username: '',
             } as UserProfile);
        }

        const userDocRef = doc(firestore, 'users', participantId);
        const unsubscribe = onSnapshot(userDocRef, 
            (docSnap) => {
                if (docSnap.exists()) {
                    setParticipant(docSnap.data() as UserProfile);
                }
            }, 
            (error) => {
                console.error(`Error fetching participant ${participantId}:`, error);
            }
        );

        return () => unsubscribe();
    }, [firestore, participantId, chat.participantDetails]);

    if (!participant) {
        return (
             <div className='flex items-center gap-4 p-4 animate-pulse'>
                <div className='h-12 w-12 rounded-full bg-muted'></div>
                <div className="flex-1 overflow-hidden space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
            </div>
        );
    }
    
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

export default function ChatPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestType[]>([]);
  const { toast } = useToast();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  useEffect(() => {
    if (!user || !firestore) {
        setLoading(false);
        return;
    }
    setLoading(true);

    const unsubProfile = onSnapshot(doc(firestore, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
        }
    });

    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(
        chatsRef,
        where('members', 'array-contains', user.uid),
        orderBy('lastMessage.timestamp', 'desc')
    );
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
        const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        setChats(chatsData);
        setLoading(false);
    });

    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
    });

    const sentRequestsRef = collection(firestore, 'friendRequests');
    const qSent = query(sentRequestsRef, where('senderId', '==', user.uid));
    const unsubSent = onSnapshot(qSent, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequestType));
        setSentRequests(requests);
    });

    return () => {
        unsubProfile();
        unsubChats();
        unsubNotifications();
        unsubSent();
    };
  }, [user, firestore]);

 const handleSearch = async (queryText: string) => {
      setSearchQuery(queryText);
      const queryLower = queryText.toLowerCase();

      if (queryLower.trim() === '') {
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
        const displayNameQuery = query(
          usersRef,
          where('displayName', '>=', queryText),
          where('displayName', '<=', queryText + '\uf8ff')
        );
        
        try {
          const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(displayNameQuery)
          ]);
          
          const resultsMap = new Map<string, UserProfile>();

          const processSnapshot = (snapshot: any) => {
              snapshot.docs.forEach((doc: any) => {
                  const userData = doc.data() as UserProfile;
                  if (userData.uid !== user.uid && !userData.isDisabled) {
                    resultsMap.set(userData.uid, userData);
                  }
              });
          };

          processSnapshot(usernameSnapshot);
          processSnapshot(displayNameSnapshot);
            
          const myBlockedList = profile.blockedUsers || [];
          const whoBlockedMe = profile.blockedBy || [];

          const finalResults = Array.from(resultsMap.values()).filter(u => 
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
          toast({ title: 'Request Sent', description: 'Your friend request has been sent.'});
      } catch (error) {
          console.error("Error sending friend request:", error);
          toast({ title: 'Error', description: 'Could not send friend request.', variant: 'destructive'});
      }
  };
  
  const handleCancelRequest = async (receiverId: string) => {
      if (!firestore || !user) return;
      
      const requestToCancel = sentRequests.find(req => req.receiverId === receiverId);
      if (!requestToCancel || !requestToCancel.id) return;
      
      const requestRef = doc(firestore, 'friendRequests', requestToCancel.id);
      
      try {
          await deleteDoc(requestRef);
          toast({ title: 'Request Cancelled' });
      } catch(error) {
           console.error("Error cancelling friend request:", error);
           toast({ title: 'Error', description: 'Could not cancel friend request.', variant: 'destructive'});
      }
  }

  const renderContent = () => {
    if (isSearching) {
        return (
            <ScrollArea className="flex-1">
                {searchResults.length === 0 && searchQuery ? (
                    <div className="p-4 text-center text-muted-foreground">
                        <p>No users found for "{searchQuery}".</p>
                    </div>
                ) : (
                    searchResults.map(foundUser => {
                    const isFriend = profile?.friends?.includes(foundUser.uid);
                    const hasSentRequest = sentRequests.some(req => req.receiverId === foundUser.uid);
                    
                    return (
                        <div key={foundUser.uid} className="flex items-center justify-between p-4 hover:bg-muted/50">
                            <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={foundUser.photoURL || undefined} />
                                    <AvatarFallback>{getInitials(foundUser.displayName)}</AvatarFallback>
                                </Avatar>
                                {foundUser.officialBadge?.isOfficial && (
                                    <div className="absolute bottom-0 right-0">
                                        <OfficialBadge color={foundUser.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={foundUser.canManageOfficials} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                    {applyNameColor(foundUser.displayName, foundUser.nameColor)}
                                    </p>
                                    {foundUser.verifiedBadge?.showBadge && (
                                        <VerifiedBadge color={foundUser.verifiedBadge.badgeColor} />
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">@{foundUser.username}</p>
                            </div>
                            </div>
                            {isFriend ? (
                                <Button asChild size="sm">
                                    <Link href={`/chat/${foundUser.uid}`}>Message</Link>
                                </Button>
                            ) : hasSentRequest ? (
                                <Button size="sm" variant="outline" onClick={() => handleCancelRequest(foundUser.uid)}>Cancel</Button>
                            ) : (
                                <Button size="sm" onClick={() => handleSendRequest(foundUser.uid)}>Add</Button>
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
    
    if (chats.length === 0) {
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
            {chats.map(chat => (
              <ChatListItem key={chat.id} chat={chat} currentUserId={user.uid} />
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
                 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" asChild>
                    <Link href="/chat/friends">
                      <Search className="h-5 w-5" />
                      <span className="sr-only">Search</span>
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
                        <span className="sr-only">Settings</span>
                    </Link>
                 </Button>
            </div>
          </div>
           {isSearching && (
             <div className="relative">
                <Input 
                    placeholder="Search users..." 
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
