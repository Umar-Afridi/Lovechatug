'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Search, MessageSquare, Users, UserPlus, Phone, GalleryHorizontal, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Chat, UserProfile, Message } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GroupsPage from './groups/page';
import FriendsPage from './friends/page';
import CallsPage from './calls/page';
import StoriesPage from './stories/page';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { collection, getDocs, addDoc, serverTimestamp, onSnapshot, doc, query, where, getDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel-react';
import { ThemeToggle } from '@/components/theme-toggle';


const ChatListItem = ({ chat, currentUserId }: { chat: Chat, currentUserId: string }) => {
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';
    const firestore = useFirestore();
    const [participant, setParticipant] = useState<UserProfile | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    };

    const participantId = useMemo(() => chat.members.find(id => id !== currentUserId), [chat.members, currentUserId]);
    
    useEffect(() => {
        if (!firestore || !participantId) return;

        const userDocRef = doc(firestore, 'users', participantId);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setParticipant(docSnap.data() as UserProfile);
            }
        }, (error) => {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        return () => unsubscribe();
    }, [firestore, participantId]);
    
    useEffect(() => {
        if (!firestore || !chat.id) return;
        const messagesRef = collection(firestore, 'chats', chat.id, 'messages');
        const q = query(
            messagesRef,
            where('senderId', '!=', currentUserId),
            where('status', '!=', 'read')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        }, (error) => {
             const permissionError = new FirestorePermissionError({
                path: messagesRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        return () => unsubscribe();

    }, [firestore, chat.id, currentUserId]);


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
                <AvatarImage src={participant.photoURL} />
                <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
            </Avatar>
            {participant.isOnline && (
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-semibold truncate">{participant.displayName}</p>
            <p className="text-sm text-muted-foreground truncate">{chat.lastMessage?.content ?? 'No messages yet'}</p>
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
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
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
  const { toast } = useToast();
  
  const navigationItems = [
    { name: 'Inbox', icon: MessageSquare, content: 'inbox' },
    { name: 'Groups', icon: Users, content: 'groups' },
    { name: 'Stories', icon: GalleryHorizontal, content: 'stories' },
    { name: 'Requests', icon: UserPlus, content: 'requests', count: requestCount },
    { name: 'Calls', icon: Phone, content: 'calls' },
  ];

  const handleTabSelect = useCallback((tabContent: string) => {
    const tabIndex = navigationItems.findIndex(item => item.content === tabContent);
    if (emblaApi && tabIndex !== -1) {
      emblaApi.scrollTo(tabIndex);
      setActiveTab(tabContent);
    }
  }, [emblaApi, navigationItems]);

  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = (emblaApi: EmblaCarouselType) => {
      const selectedIndex = emblaApi.selectedScrollSnap();
      setActiveTab(navigationItems[selectedIndex].content);
    };

    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, navigationItems]);
  
  // Fetch user profile
  useEffect(() => {
    if (!user || !firestore) {
      setLoadingProfile(false);
      return;
    }
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsub = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
        }
        setLoadingProfile(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoadingProfile(false);
    });
    return () => unsub();
  }, [user, firestore]);

  // Fetch chats based on user's chatIds
  useEffect(() => {
    if (!firestore || !profile?.chatIds || profile.chatIds.length === 0) {
      setLoadingChats(false);
      setChats([]);
      return;
    }

    setLoadingChats(true);
    const chatRefs = profile.chatIds.map(id => doc(firestore, 'chats', id));
    
    const unsubscribes = chatRefs.map(chatRef => 
        onSnapshot(chatRef, (docSnap) => {
            if (docSnap.exists()) {
                const newChat = { id: docSnap.id, ...docSnap.data() } as Chat;
                setChats(currentChats => {
                    const existingChatIndex = currentChats.findIndex(c => c.id === newChat.id);
                    if (existingChatIndex > -1) {
                        const updatedChats = [...currentChats];
                        updatedChats[existingChatIndex] = newChat;
                        return updatedChats;
                    } else {
                        return [...currentChats, newChat];
                    }
                });
            }
        }, (error) => {
             const permissionError = new FirestorePermissionError({
                path: chatRef.path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
        })
    );
    
    setLoadingChats(false);

    return () => unsubscribes.forEach(unsub => unsub());

  }, [firestore, profile?.chatIds]);


   useEffect(() => {
    if (!firestore || !user?.uid) return;

    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(requestsRef, where('receiverId', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setRequestCount(snapshot.size);
      },
      (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: requestsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Error fetching friend request count:", serverError);
      }
    );

    return () => unsubscribe();
  }, [firestore, user]);


  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim() === '') {
        setSearchResults([]);
        return;
      }

      if (firestore && user) {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', searchQuery.toLowerCase()));
        
        try {
          const querySnapshot = await getDocs(q);
          const filteredUsers = querySnapshot.docs
                .map(doc => doc.data() as UserProfile)
                .filter(u => u.uid !== user.uid);
            
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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const handleAddRequest = async (receiverId: string) => {
    if (!firestore || !user) {
        toast({ title: 'Error', description: 'You must be logged in to send a friend request.', variant: 'destructive' });
        return;
    }

    if (profile?.friends?.includes(receiverId)) {
        toast({ title: 'Already Friends', description: 'You are already friends with this user.'});
        return;
    }

    const requestsRef = collection(firestore, 'friendRequests');
    const q1 = query(requestsRef, where('senderId', '==', user.uid), where('receiverId', '==', receiverId));
    const q2 = query(requestsRef, where('senderId', '==', receiverId), where('receiverId', '==', user.uid));

    try {
        const [q1Snap, q2Snap] = await Promise.all([getDocs(q1), getDocs(q2)]);

        if (!q1Snap.empty || !q2Snap.empty) {
            toast({ title: 'Request Already Exists', description: 'A friend request is already pending.'});
            return;
        }

        const newRequest = {
            senderId: user.uid,
            receiverId: receiverId,
            status: 'pending' as const,
            createdAt: serverTimestamp()
        };

        addDoc(requestsRef, newRequest)
            .then(() => {
                toast({ title: 'Success', description: 'Friend request sent!' });
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: requestsRef.path,
                    operation: 'create',
                    requestResourceData: newRequest
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    } catch (err: any) {
        const permissionError = new FirestorePermissionError({
            path: requestsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };
  
  const renderSearchResults = () => {
    if (searchQuery.trim() !== '' && searchResults.length === 0) {
        return (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p>No users found matching your search.</p>
          </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
        {searchResults.map(foundUser => {
            const isFriend = profile?.friends?.includes(foundUser.uid);
            return (
            <div key={foundUser.uid} className="flex items-center justify-between p-4 hover:bg-muted/50">
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
                {isFriend ? (
                    <Button asChild size="sm">
                        <Link href={`/chat/${foundUser.uid}`}>Message</Link>
                    </Button>
                ) : (
                    <Button size="sm" onClick={() => handleAddRequest(foundUser.uid)}>Add Request</Button>
                )}
            </div>
            );
        })}
        </ScrollArea>
    );
  }

  const renderContent = () => {
    if (searchQuery.trim() !== '') {
      return <div className="flex-1 flex flex-col overflow-hidden">{renderSearchResults()}</div>;
    }
    
    return (
      <div className="overflow-hidden flex-1" ref={emblaRef}>
        <div className="flex h-full">
          {navigationItems.map(item => (
            <div className="flex-[0_0_100%] min-w-0 h-full flex flex-col" key={item.content}>
               {item.content === 'inbox' && (loadingChats || loadingProfile || !user ? <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading chats...</div> : <ChatList chats={chats} currentUserId={user.uid} />)}
               {item.content === 'groups' && <GroupsPage />}
               {item.content === 'stories' && <StoriesPage />}
               {item.content === 'requests' && <FriendsPage />}
               {item.content === 'calls' && <CallsPage />}
            </div>
          ))}
        </div>
      </div>
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
                 <ThemeToggle />
                 <Button variant="ghost" className="relative h-10 w-10 rounded-full" asChild>
                    <Link href="/settings">
                      <Settings className="h-5 w-5" />
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
        <div className='flex border-b'>
            {navigationItems.map((item) => (
                <Button 
                    key={item.content}
                    variant="ghost" 
                    className={cn(
                        "flex-1 justify-center gap-2 rounded-none relative",
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
        <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
        </div>

      </div>
    </div>
  );
}
