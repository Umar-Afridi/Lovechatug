'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Search, MessageSquare, UserPlus, Phone, Settings, Home, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Chat, UserProfile, FriendRequest, Notification as NotificationType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import FriendsPage from './friends/page';
import CallsPage from './calls/page';
import RoomsPage from './rooms/page';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { collection, onSnapshot, doc, query, where, getDocs, updateDoc, addDoc, deleteDoc, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

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


const ChatList = ({ chats, currentUserId }: { chats: Chat[], currentUserId: string }) => {
    
    if (chats.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
           <p>No chats yet. Find friends and start a conversation!</p>
        </div>
      )
    }

    return (
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {chats.map(chat => (
              <ChatListItem key={chat.id} chat={chat} currentUserId={currentUserId} />
            ))}
          </div>
        </ScrollArea>
    );
};


export default function ChatPage() {
  const [activeTab, setActiveTab] = useState('inbox');
  const firestore = useFirestore();
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const { toast } = useToast();

  const touchStartX = useRef(0);
  const touchMoveX = useRef(0);
  
  const navigationItems = [
    { name: 'Inbox', icon: MessageSquare, content: 'inbox' },
    { name: 'Rooms', icon: Home, content: 'rooms' },
    { name: 'Requests', icon: UserPlus, content: 'requests', count: requestCount },
    { name: 'Calls', icon: Phone, content: 'calls' },
  ];
  const tabOrder = navigationItems.map(item => item.content);

  const handleTabSelect = useCallback((tabContent: string) => {
    setActiveTab(tabContent);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchMoveX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchMoveX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50; // Minimum distance for a swipe
    const movedX = touchMoveX.current - touchStartX.current;

    if (Math.abs(movedX) > swipeThreshold) {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (movedX < 0) { // Swiped left
        const nextIndex = Math.min(currentIndex + 1, tabOrder.length - 1);
        setActiveTab(tabOrder[nextIndex]);
      } else { // Swiped right
        const prevIndex = Math.max(currentIndex - 1, 0);
        setActiveTab(tabOrder[prevIndex]);
      }
    }
  };

  // Combined effect to fetch all necessary data
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
    }, (error) => {
        console.error("Error fetching profile:", error);
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
    }, (error) => {
        console.error("Error fetching chats:", error);
        setLoading(false);
    });
    
    const incomingRequestsRef = collection(firestore, 'friendRequests');
    const qIncoming = query(incomingRequestsRef, where('receiverId', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribeIncoming = onSnapshot(qIncoming, 
      (snapshot) => {
        setRequestCount(snapshot.size);
      },
      (error) => {
        console.error("Error fetching friend request count:", error);
      }
    );
    
    const sentRequestsRef = collection(firestore, 'friendRequests');
    const qSent = query(sentRequestsRef, where('senderId', '==', user.uid));
    
    const unsubscribeSent = onSnapshot(qSent, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setSentRequests(requests);
    }, (error) => {
        console.error("Error fetching sent requests:", error);
    });

    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));

    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
    }, (error) => {
        console.error("Error fetching notifications:", error);
    });

    return () => {
        unsubProfile();
        unsubChats();
        unsubscribeIncoming();
        unsubscribeSent();
        unsubscribeNotifications();
    };
  }, [user, firestore]);


  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim() === '') {
        setSearchResults([]);
        return;
      }

      if (firestore && user && profile) {
        const usersRef = collection(firestore, 'users');
        const q = query(
          usersRef, 
          where('username', '==', searchQuery.toLowerCase())
        );
        
        try {
          const querySnapshot = await getDocs(q);
          const myBlockedList = profile.blockedUsers || [];
          const whoBlockedMe = profile.blockedBy || [];

          const filteredUsers = querySnapshot.docs
                .map(doc => doc.data() as UserProfile)
                .filter(u => 
                    u.uid !== user.uid && // Not me
                    !u.isDisabled && // Not disabled
                    !myBlockedList.includes(u.uid) && // I haven't blocked them
                    !whoBlockedMe.includes(u.uid) // They haven't blocked me
                );
            
          setSearchResults(filteredUsers);
        } catch (serverError) {
            console.error("Error searching users:", serverError);
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


  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };
  
  const renderContent = () => {
    if (searchQuery.trim() !== '') {
      if (searchResults.length === 0) {
        return (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p>No users found matching your search.</p>
          </div>
        );
      }
      return (
        <ScrollArea className="flex-1">
          <div>
            {searchResults.map(foundUser => {
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
                        <Button size="sm" variant="outline" onClick={() => handleCancelRequest(foundUser.uid)}>Cancel Request</Button>
                    ) : (
                        <Button size="sm" onClick={() => handleSendRequest(foundUser.uid)}>Add friend</Button>
                    )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      );
    }
    
    switch (activeTab) {
        case 'inbox':
            return (loading || !user ? <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading chats...</div> : <ChatList chats={chats} currentUserId={user.uid} />);
        case 'rooms':
            return <RoomsPage />;
        case 'requests':
            return <FriendsPage />;
        case 'calls':
            return <CallsPage />;
        default:
            return null;
    }
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
                 <Button variant="ghost" className="relative h-10 w-10 rounded-full" asChild>
                    <Link href="/profile">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                            src={profile?.photoURL ?? undefined}
                            alt={profile?.displayName ?? 'user-avatar'}
                        />
                        <AvatarFallback>
                            {getInitials(profile?.displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                </Button>
            </div>
          </div>
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Input 
                placeholder="Search users by username..." 
                className="pr-12 pl-4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button type="submit" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
          </form>
        </div>
        
        {/* Navigation */}
        <div className='flex border-b overflow-x-auto'>
            {navigationItems.map((item) => (
                <Button 
                    key={item.content}
                    variant="ghost" 
                    className={cn(
                        "flex-shrink-0 justify-center gap-2 rounded-none relative px-4 py-4 h-auto",
                        activeTab === item.content ? 'border-b-2 border-primary text-primary bg-primary/10' : 'text-muted-foreground'
                    )}
                    onClick={() => handleTabSelect(item.content)}
                >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    {item.content === 'requests' && requestCount > 0 && (
                        <Badge variant="destructive" className="absolute top-1 right-1 h-5 w-5 justify-center p-0">{requestCount}</Badge>
                    )}
                </Button>
            ))}
        </div>
        
        {/* Content */}
        <div 
          className="flex-1 flex flex-col overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
            {renderContent()}
        </div>

      </div>
    </div>
  );
}
