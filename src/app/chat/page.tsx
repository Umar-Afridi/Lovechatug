'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Search, MessageSquare, Users, UserPlus, Phone, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Chat, UserProfile, FriendRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GroupsPage from './groups/page';
import FriendsPage from './friends/page';
import CallsPage from './calls/page';
import StoriesPage from './stories/page';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { collection, onSnapshot, doc, query, where, getDocs, getDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { VerifiedBadge } from '@/components/ui/verified-badge';


const ChatListItem = ({ chat, currentUserId }: { chat: Chat, currentUserId: string }) => {
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';
    const firestore = useFirestore();
    const [participant, setParticipant] = useState<UserProfile | null>(null);
    
    // The unread count is now directly on the chat object
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

        // Use the pre-filled details if available, otherwise fetch
        const prefilledDetails = chat.participantDetails?.[participantId];
        if (prefilledDetails?.displayName) {
             setParticipant({
                uid: participantId,
                displayName: prefilledDetails.displayName,
                photoURL: prefilledDetails.photoURL,
                // Add other required fields with default values
                email: '',
                username: '',
             });
        }

        const userDocRef = doc(firestore, 'users', participantId);
        const unsubscribe = onSnapshot(userDocRef, 
            (docSnap) => {
                if (docSnap.exists()) {
                    setParticipant(docSnap.data() as UserProfile);
                }
            }, 
            (error) => {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
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
            <Avatar>
                <AvatarImage src={participant.photoURL || undefined} />
                <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
            </Avatar>
            {participant.isOnline && (
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{participant.displayName}</p>
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
    const sortedChats = useMemo(() => {
        return [...chats].sort((a, b) => {
            const aTime = a.lastMessage?.timestamp?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
            const bTime = b.lastMessage?.timestamp?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
        });
    }, [chats]);

    if (sortedChats.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
           <p>No chats yet. Find friends and start a conversation!</p>
        </div>
      )
    }

    return (
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {sortedChats.map(chat => (
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
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [requestCount, setRequestCount] = useState(0);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const { toast } = useToast();

  const touchStartX = useRef(0);
  const touchMoveX = useRef(0);
  
  const navigationItems = [
    { name: 'Inbox', icon: MessageSquare, content: 'inbox' },
    { name: 'Groups', icon: Users, content: 'groups' },
    { name: 'Stories', icon: Users, content: 'stories' },
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

  // Fetch user profile
  useEffect(() => {
    if (!user || !firestore) {
      setLoadingProfile(false);
      return;
    }
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const userProfile = docSnap.data() as UserProfile;
            setProfile(userProfile);
            setLoadingProfile(false);
        } else {
            setLoadingProfile(false);
        }
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoadingProfile(false);
    });

    // Setup chat listeners based on profile's chatIds
    let unsubChats: (() => void)[] = [];
    const unsubProfileAndChats = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userProfile = docSnap.data() as UserProfile;
            setProfile(userProfile); // also update profile state here

            // Unsubscribe from old chat listeners
            unsubChats.forEach(unsub => unsub());
            unsubChats = [];

            if (userProfile.chatIds && userProfile.chatIds.length > 0 && firestore) {
                setLoadingChats(true);
                
                // Filter out chats with users who have blocked the current user
                const chatIdsToListen = userProfile.chatIds;
                
                if (chatIdsToListen.length > 0) {
                  const chatRefs = chatIdsToListen.map(id => doc(firestore, 'chats', id));

                  unsubChats = chatRefs.map(chatRef => onSnapshot(chatRef,
                      (chatDoc) => {
                          if (chatDoc.exists()) {
                              const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
                              
                              // Check if the other member has blocked the current user
                              const otherMemberId = chatData.members.find(id => id !== user.uid);
                              const myBlockedBy = userProfile.blockedBy || [];

                              if (otherMemberId && !myBlockedBy.includes(otherMemberId)) {
                                  setChats(prevChats => {
                                      const chatIndex = prevChats.findIndex(c => c.id === chatDoc.id);
                                      if (chatIndex > -1) {
                                          const newChats = [...prevChats];
                                          newChats[chatIndex] = chatData;
                                          return newChats;
                                      } else {
                                          return [...prevChats, chatData];
                                      }
                                  });
                              } else {
                                // If I am blocked, remove the chat from my list
                                setChats(prevChats => prevChats.filter(c => c.id !== chatDoc.id));
                              }

                          } else {
                            // Chat document might have been deleted (e.g., unfriend)
                             setChats(prevChats => prevChats.filter(c => c.id !== chatRef.id));
                          }
                      },
                      (error) => {
                           const permissionError = new FirestorePermissionError({
                              path: chatRef.path,
                              operation: 'get',
                          });
                          errorEmitter.emit('permission-error', permissionError);
                          console.error(`Error listening to chat ${chatRef.id}:`, error);
                      }
                  ));
                }
                setLoadingChats(false);
            } else {
                setChats([]);
                setLoadingChats(false);
            }
        }
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Error setting up combined profile and chat listener:", error);
    });

    return () => { 
        unsubProfile();
        unsubProfileAndChats();
        unsubChats.forEach(unsub => unsub());
    };
  }, [user, firestore]);

   useEffect(() => {
    if (!firestore || !user?.uid) return;

    // Listener for incoming friend requests (for the badge count)
    const incomingRequestsRef = collection(firestore, 'friendRequests');
    const qIncoming = query(incomingRequestsRef, where('receiverId', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribeIncoming = onSnapshot(qIncoming, 
      (snapshot) => {
        setRequestCount(snapshot.size);
      },
      (serverError) => {
        const permissionError = new FirestorePermissionError({ path: incomingRequestsRef.path, operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
      }
    );
    
    // Listener for requests sent by the current user (to manage button state)
    const sentRequestsRef = collection(firestore, 'friendRequests');
    const qSent = query(sentRequestsRef, where('senderId', '==', user.uid));
    
    const unsubscribeSent = onSnapshot(qSent, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setSentRequests(requests);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({ path: sentRequestsRef.path, operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeSent();
    };
  }, [firestore, user]);

  const filteredChats = useMemo(() => {
    if (!profile || !user) return [];
    const blockedByMe = profile.blockedUsers || [];
    const whoBlockedMe = profile.blockedBy || [];
    
    return chats.filter(chat => {
        const otherMemberId = chat.members.find(id => id !== user.uid);
        if (!otherMemberId) return false;
        // Don't show chat if I blocked them, or if they blocked me
        return !blockedByMe.includes(otherMemberId) && !whoBlockedMe.includes(otherMemberId);
    });
  }, [chats, profile, user]);


  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim() === '') {
        setSearchResults([]);
        return;
      }

      if (firestore && user && profile) {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', searchQuery.toLowerCase()));
        
        try {
          const querySnapshot = await getDocs(q);
          const myBlockedList = profile.blockedUsers || [];
          const whoBlockedMe = profile.blockedBy || [];

          const filteredUsers = querySnapshot.docs
                .map(doc => doc.data() as UserProfile)
                .filter(u => 
                    u.uid !== user.uid && // Not me
                    !myBlockedList.includes(u.uid) && // I haven't blocked them
                    !whoBlockedMe.includes(u.uid) // They haven't blocked me
                );
            
          setSearchResults(filteredUsers);
        } catch (serverError) {
            const permissionError = new FirestorePermissionError({
                path: usersRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
      }
    };
    
  const handleSendRequest = async (receiverId: string) => {
      if (!firestore || !user) return;
      const requestsRef = collection(firestore, 'friendRequests');
      const newRequest = {
          senderId: user.uid,
          receiverId: receiverId,
          status: 'pending' as const
      };
      
      try {
          await addDoc(requestsRef, newRequest);
          toast({ title: 'Request Sent', description: 'Your friend request has been sent.'});
      } catch (error) {
          console.error("Error sending friend request:", error);
          const permissionError = new FirestorePermissionError({ path: requestsRef.path, operation: 'create', requestResourceData: newRequest });
          errorEmitter.emit('permission-error', permissionError);
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
           const permissionError = new FirestorePermissionError({ path: requestRef.path, operation: 'delete' });
           errorEmitter.emit('permission-error', permissionError);
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
                    <Avatar>
                        <AvatarImage src={foundUser.photoURL || undefined} />
                        <AvatarFallback>{getInitials(foundUser.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                           <p className="font-semibold">{foundUser.displayName}</p>
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
                        <Button size="sm" onClick={() => handleSendRequest(foundUser.uid)}>Add Request</Button>
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
            return (loadingChats || loadingProfile || !user ? <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading chats...</div> : <ChatList chats={filteredChats} currentUserId={user.uid} />);
        case 'groups':
            return <GroupsPage />;
        case 'stories':
            return <StoriesPage />;
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
                 <ThemeToggle />
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

    