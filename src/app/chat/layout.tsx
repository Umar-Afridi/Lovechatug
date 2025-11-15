'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Users,
  Phone,
  Settings,
  UserPlus,
  LogOut,
  GalleryHorizontal,
  PlusSquare,
  Home,
  Inbox,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarProvider,
  SidebarInset,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { useAuth, useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDoc, writeBatch, limit } from 'firebase/firestore';
import type { UserProfile, Room, Chat, Call } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getDatabase, ref, onValue, off, onDisconnect, serverTimestamp as rtdbServerTimestamp, set } from 'firebase/database';
import { useSound } from '@/hooks/use-sound';
import { FloatingRoomIndicator } from '@/components/chat/floating-room-indicator';
import { IncomingCall } from '@/components/chat/incoming-call';


// Context for sharing current room state
interface RoomContextType {
  currentRoom: Room | null;
  setCurrentRoom: (room: Room | null) => void;
  leaveCurrentRoom: () => void;
  inboxCount: number;
}

const RoomContext = createContext<RoomContextType | null>(null);

export const useRoomContext = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoomContext must be used within a ChatAppLayout');
  }
  return context;
};


// Custom hook to get user profile data in real-time
function useUserProfile(onAccountDisabled: () => void) {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user || !firestore) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);

          if (data.isDisabled) {
            onAccountDisabled();
          }
        } else {
          // This case might happen for a brand new user before the doc is created
          // We can set a temporary profile
          setProfile({
            uid: user.uid,
            displayName: user.displayName || 'User',
            email: user.email || '',
            photoURL: user.photoURL || '',
            username: user.email?.split('@')[0] || `user-${Date.now()}`
          } as UserProfile);
        }
        setLoading(false);
      }, 
      (error) => {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, firestore, authLoading, onAccountDisabled]);

  return { profile, loading };
}

// Custom hook for presence management
function usePresence() {
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (!user || !firestore) return;

    const db = getDatabase();
    const userStatusDatabaseRef = ref(db, '/status/' + user.uid);
    const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
    const connectedRef = ref(db, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        const presenceData = { isOnline: true, lastSeen: rtdbServerTimestamp() };
        set(userStatusDatabaseRef, presenceData);

        onDisconnect(userStatusDatabaseRef).set({ isOnline: false, lastSeen: rtdbServerTimestamp() });

        const firestoreUpdateData = { isOnline: true, lastSeen: serverTimestamp() };
        updateDoc(userStatusFirestoreRef, firestoreUpdateData).catch(err => {
            console.warn("Could not update online status in Firestore:", err);
        });
      }
    }, (error) => {
      console.error("Error with presence listener:", error);
    });

    return () => {
       if (typeof unsubscribe === 'function') {
        off(connectedRef, 'value', unsubscribe);
      }
       set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });
       updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(err => {
            // silent fail on sign out is okay
       });
    };
  }, [user, firestore]);
}

// Custom hook for incoming calls
function useIncomingCalls() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  useEffect(() => {
    if (!user || !firestore || authLoading) return;

    const callsRef = collection(firestore, 'calls');
    const q = query(
      callsRef,
      where('receiverId', '==', user.uid),
      where('status', '==', 'outgoing'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        setIncomingCall({ id: callDoc.id, ...callDoc.data() } as Call);
      } else {
        setIncomingCall(null);
      }
    }, (error) => {
      console.error('Error listening for incoming calls:', error);
    });

    return () => unsubscribe();
  }, [user, firestore, authLoading]);

  const clearIncomingCall = () => setIncomingCall(null);

  return { incomingCall, clearIncomingCall };
}


export default function ChatAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isChatDetailPage = pathname.startsWith('/chat/') && pathname.split('/').length > 2 && !pathname.startsWith('/chat/friends') && !pathname.startsWith('/chat/calls') && !pathname.startsWith('/chat/rooms');
  const [requestCount, setRequestCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [isAccountDisabled, setAccountDisabled] = useState(false);
  const { toast } = useToast();
  
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const { incomingCall, clearIncomingCall } = useIncomingCalls();

  const handleAccountDisabled = useCallback(() => {
    setAccountDisabled(true);
  }, []);
  
  const { profile, loading: profileLoading } = useUserProfile(handleAccountDisabled);
  usePresence(); // Initialize presence management

  const playRequestSound = useSound('https://commondatastorage.googleapis.com/codeskulptor-assets/week7-brrring.m4a');
  const isFirstRequestLoad = useRef(true);
  
  const leaveCurrentRoom = useCallback(async () => {
    if (!firestore || !user || !currentRoom) return;
    
    const memberRef = doc(firestore, 'rooms', currentRoom.id, 'members', user.uid);
    const roomRef = doc(firestore, 'rooms', currentRoom.id);
    
    try {
        const batch = writeBatch(firestore);
        batch.delete(memberRef);
        
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists() && (memberDoc.data() as UserProfile).micSlot !== -1) {
            const roomDoc = await getDoc(roomRef);
            if (roomDoc.exists() && roomDoc.data().memberCount > 0) {
              batch.update(roomRef, { memberCount: -1 });
            }
        }
        await batch.commit();
    } catch(e) {
        console.warn("Could not leave room properly", e);
    }
    setCurrentRoom(null);
  }, [firestore, user, currentRoom]);


  useEffect(() => {
    if (!firestore || !user?.uid) {
      return;
    }

    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(requestsRef, where('receiverId', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const newSize = snapshot.size;
        if (!isFirstRequestLoad.current && newSize > requestCount) {
          playRequestSound();
        }
        setRequestCount(newSize);
        isFirstRequestLoad.current = false;
      },
      (serverError) => {
        console.error("Error fetching friend request count:", serverError);
      }
    );

    return () => unsubscribe();
  }, [firestore, user?.uid, requestCount, playRequestSound]);
  
  // New listener for total unread messages
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(chatsRef, where('members', 'array-contains', user.uid));
    
    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
        let totalUnread = 0;
        snapshot.forEach(doc => {
            const chat = doc.data() as Chat;
            totalUnread += chat.unreadCount?.[user.uid] ?? 0;
        });
        setInboxCount(totalUnread);
    });

    return () => unsubscribeChats();

  }, [firestore, user?.uid]);


 useEffect(() => {
    if (!authLoading) {
      if (user) {
        if (pathname === '/' || pathname === '/signup') {
          router.push('/chat');
        }
      } else {
        if (pathname.startsWith('/chat') || pathname.startsWith('/profile') || pathname.startsWith('/settings')) {
          router.push('/');
        }
      }
    }
  }, [authLoading, user, pathname, router]);

  const handleSignOut = async () => {
    if (auth && user && firestore) {
      if(currentRoom) {
         await leaveCurrentRoom();
      }
      const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
      const db = getDatabase();
      const userStatusDatabaseRef = ref(db, '/status/' + user.uid);

      await updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() });
      await set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });

      await auth.signOut();
      router.push('/');
    }
  };

  const loading = authLoading || profileLoading;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user && !isAccountDisabled && (pathname.startsWith('/chat') || pathname.startsWith('/profile') || pathname.startsWith('/settings'))) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <p>Redirecting...</p>
      </div>
    );
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const showSidebar = !isMobile || !isChatDetailPage;
  
  const menuItems = [
    {
      href: '/chat',
      icon: Inbox,
      label: 'Inbox',
      id: 'inbox',
      count: inboxCount
    },
    {
      href: '/chat/rooms',
      icon: Home,
      label: 'Rooms',
    },
    {
       href: '/chat/friends',
       icon: UserPlus,
       label: 'Requests',
       id: 'friend-requests',
       count: requestCount,
    },
    {
       href: '/chat/calls',
       icon: Phone,
       label: 'Calls',
    },
  ];

  if (!user) {
      return <>{children}</>;
  }


  return (
    <RoomContext.Provider value={{ currentRoom, setCurrentRoom, leaveCurrentRoom, inboxCount }}>
      <AlertDialog open={isAccountDisabled}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Account Disabled</AlertDialogTitle>
              <AlertDialogDescription>
                Your account has been disabled by an administrator. You will be logged out.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleSignOut}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {incomingCall && (
            <IncomingCall call={incomingCall} onHandled={clearIncomingCall} />
        )}

      <div className="flex h-screen bg-background">
        <SidebarProvider>
          {showSidebar && (
            <Sidebar side="left" collapsible="icon" className="group hidden md:flex">
                <SidebarHeader>
                    <Link href="/profile" className="h-12 w-full justify-start gap-2 px-2 flex items-center">
                        <Avatar className="h-8 w-8">
                        <AvatarImage
                            src={profile?.photoURL ?? undefined}
                            alt={profile?.displayName ?? 'user-avatar'}
                        />
                        <AvatarFallback>
                            {getInitials(profile?.displayName)}
                        </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                        <span className={cn(
                          "truncate text-sm font-medium",
                          profile?.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                        )}>
                            {profile?.displayName ?? 'User'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {profile?.email ?? 'No email'}
                        </span>
                        </div>
                    </Link>
                </SidebarHeader>
                <SidebarContent>
                <SidebarMenu>
                    {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <Link href={item.href}>
                        <SidebarMenuButton
                            isActive={pathname === item.href || (item.id === 'inbox' && pathname.startsWith('/chat') && !menuItems.slice(1).some(i => pathname.startsWith(i.href)))}
                            tooltip={item.label}
                        >
                            <item.icon />
                            <span>{item.label}</span>
                             {item.count !== undefined && item.count > 0 && (
                                <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                            )}
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                      <Link href="/profile" className="w-full">
                        <SidebarMenuButton tooltip="Settings">
                            <Settings />
                            <span>Settings</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                      <SidebarMenuItem>
                          <SidebarMenuButton tooltip="Logout" onClick={handleSignOut}>
                              <LogOut />
                              <span>Logout</span>
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
          )}
          <SidebarInset>
            {children}
            {currentRoom && !pathname.startsWith(`/chat/rooms/${currentRoom.id}`) && (
              <FloatingRoomIndicator room={currentRoom} />
            )}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </RoomContext.Provider>
  );
}
