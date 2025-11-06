'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { collection, getDocs, addDoc, serverTimestamp, onSnapshot, doc, query, where, getDoc, Timestamp, orderBy, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// Custom hook to get user profile data in real-time
function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !firestore) {
      setLoading(false);
      return;
    }
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsub = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
        }
        setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });
    return () => unsub();
  }, [user, firestore, authLoading]);

  return { profile, loading };
}


const ChatList = ({ chats, blockedUsers }: { chats: Chat[], blockedUsers: string[] }) => {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

    const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return '';
      // Convert Firestore Timestamp to JS Date
      const date = timestamp.toDate();
      return formatDistanceToNow(date, { addSuffix: true });
    };
    
    const filteredChats = chats.filter(chat => !blockedUsers.includes(chat.participantDetails?.id ?? ''));

    if (filteredChats.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
           <p>No chats yet. Find friends and start a conversation!</p>
        </div>
      )
    }

    return (
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {filteredChats.map(chat => (
              <Link href={`/chat/${chat.participantDetails?.id}`} key={chat.id}>
                <div 
                  className='flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50'
                >
                  <Avatar>
                    <AvatarImage src={chat.participantDetails?.avatar} />
                    <AvatarFallback>{getInitials(chat.participantDetails?.name ?? '')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{chat.participantDetails?.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{chat.lastMessage?.content ?? 'No messages yet'}</p>
                  </div>
                  <div className="flex flex-col items-end text-xs text-muted-foreground">
                    <span>{formatTimestamp(chat.lastMessage?.timestamp)}</span>
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
  const [activeTab, setActiveTab] = useState('inbox');
  const firestore = useFirestore();
  const { user } = useUser();
  const { profile, loading: loadingProfile } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const { toast } = useToast();

   // Fetch user's chats in real-time
   useEffect(() => {
    if (!user || !firestore) return;

    setLoadingChats(true);
    const chatsRef = collection(firestore, 'chats');
    const q = query(chatsRef, where('members', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            const otherParticipantId = chatData.members.find((p: string) => p !== user.uid);
            
            if (otherParticipantId) {
                try {
                    // Fetch participant details
                    const userDoc = await getDoc(doc(firestore, 'users', otherParticipantId));
                    
                    // Fetch unread messages count
                    const messagesRef = collection(firestore, 'chats', chatDoc.id, 'messages');
                    const messagesSnapshot = await getDocs(messagesRef);
                    const unreadCount = messagesSnapshot.docs.filter(doc => {
                        const data = doc.data();
                        return data.senderId === otherParticipantId && data.status !== 'read';
                    }).length;


                    if (userDoc.exists()) {
                        const userData = userDoc.data() as UserProfile;
                        return {
                            id: chatDoc.id,
                            ...chatData,
                            lastMessage: chatData.lastMessage || null,
                            unreadCount: unreadCount, // Set unread count
                            participantDetails: {
                                id: userData.uid,
                                name: userData.displayName,
                                avatar: userData.photoURL
                            }
                        } as Chat;
                    }
                } catch(err: any) {
                    if(err.code !== 'permission-denied') {
                      console.error("Error processing chat:", err);
                    }
                    // Permission denied can be ignored if rules are strict
                }
            }
            return null;
        });

        let resolvedChats = (await Promise.all(chatPromises)).filter(c => c !== null) as Chat[];
        
        // Sort chats by last message timestamp on the client
        resolvedChats.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp?.toMillis() || 0;
            const timeB = b.lastMessage?.timestamp?.toMillis() || 0;
            return timeB - timeA;
        });

        setChats(resolvedChats);
        setLoadingChats(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: chatsRef.path, operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
        setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);


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
        // This will catch errors from getDocs if any
        const permissionError = new FirestorePermissionError({
            path: requestsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };
  
  const navigationItems = [
    { name: 'Inbox', icon: MessageSquare, content: 'inbox' },
    { name: 'Groups', icon: Users, content: 'groups' },
    { name: 'Stories', icon: GalleryHorizontal, content: 'stories' },
    { name: 'Requests', icon: UserPlus, content: 'requests' },
    { name: 'Calls', icon: Phone, content: 'calls' },
  ];

  const renderSearchResults = () => {
      if (searchResults.length > 0) {
        return (
          <ScrollArea className="flex-1">
            {searchResults.map(foundUser => (
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
                <Button size="sm" onClick={() => handleAddRequest(foundUser.uid)}>Add Request</Button>
              </div>
            ))}
          </ScrollArea>
        );
      } else {
         return (
           <div className="flex flex-1 items-center justify-center text-muted-foreground">
             <p>No users found matching your search.</p>
           </div>
         );
      }
  }

  const renderContent = () => {
    if (searchQuery.trim() !== '') {
      return renderSearchResults();
    }
    
    switch(activeTab) {
        case 'inbox':
            return loadingChats || loadingProfile ? <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading chats...</div> : <ChatList chats={chats} blockedUsers={profile?.blockedUsers ?? []} />;
        case 'groups':
            return <GroupsPage />;
        case 'stories':
            return <StoriesPage />;
        case 'requests':
            return <FriendsPage />;
        case 'calls':
            return <CallsPage />;
        default:
            return <ChatList chats={chats} blockedUsers={profile?.blockedUsers ?? []} />;
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
                    key={item.name}
                    variant="ghost" 
                    className={cn(
                        "flex-1 justify-center gap-2 rounded-none",
                        activeTab === item.content ? 'border-b-2 border-primary text-primary bg-primary/10' : 'text-muted-foreground'
                    )}
                    onClick={() => setActiveTab(item.content)}
                >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
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
