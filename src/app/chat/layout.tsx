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
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDoc, writeBatch, limit, addDoc, deleteDoc } from 'firebase/firestore';
import type { UserProfile, Room, Chat, Call, Notification } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getDatabase, ref, onValue, off, onDisconnect, serverTimestamp as rtdbServerTimestamp, set } from 'firebase/database';
import { useSound } from '@/hooks/use-sound';
import { FloatingRoomIndicator } from '@/components/chat/floating-room-indicator';
import { IncomingCall } from '@/components/chat/incoming-call';
import ActiveCallPage from './call/active/[callId]/page';
import OutgoingCallPage from './call/outgoing/[userId]/page';


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

// Context for Call State
interface CallContextType {
  activeCall: Call | null;
  outgoingCall: (Omit<Call, 'id' | 'timestamp' | 'participants' | 'status' | 'direction'> & { callId?: string }) | null;
  incomingCall: Call | null;
  startCall: (userId: string, type: 'audio' | 'video') => void;
  acceptCall: (call: Call) => void;
  declineCall: (call: Call) => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};

const SYSTEM_SENDER_ID = 'system_lovechat';
const SYSTEM_SENDER_NAME = 'Love Chat';
const SYSTEM_SENDER_PHOTO_URL = 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/UG_LOGO_RED.png?alt=media&token=e632b0a9-4678-4384-9549-01e403d5b00c';

// Custom hook to get user profile data in real-time
function useUserProfile(onAccountDisabled: () => void) {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const previousProfileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user || !firestore) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(firestore, 'users', user.uid);

    const sendOfficialStatusNotification = async (newStatus: boolean) => {
        let message = '';
        let notifType: Notification['type'];

        if (newStatus) {
            message = "Congratulations! You have been promoted to an Official user. Please use your new status to help and guide the community.";
            notifType = 'official_badge_granted';
        } else {
            message = "Your Official user status has been revoked because it was not used in the intended way. We are sorry for this action.";
            notifType = 'official_badge_removed';
        }

        const notification: any = {
            userId: user.uid,
            title: SYSTEM_SENDER_NAME,
            message,
            type: notifType,
            isRead: false,
            createdAt: serverTimestamp(),
            senderId: SYSTEM_SENDER_ID,
            senderName: SYSTEM_SENDER_NAME,
            senderPhotoURL: SYSTEM_SENDER_PHOTO_URL,
        };

        try {
            await addDoc(collection(firestore, 'users', user.uid, 'notifications'), notification);
        } catch (e) {
            console.error("Failed to send official status notification", e);
        }
    };


    const unsubscribe = onSnapshot(userDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);

          if (data.isDisabled) {
            onAccountDisabled();
          }

          // Check for official status change
          const previousProfile = previousProfileRef.current;
          if (previousProfile && previousProfile.officialBadge?.isOfficial !== data.officialBadge?.isOfficial) {
              sendOfficialStatusNotification(data.officialBadge?.isOfficial ?? false);
          }
          
          previousProfileRef.current = data; // Update ref with current data for next snapshot

        } else {
          // This case might happen for a brand new user before the doc is created
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

    return () => {
        unsubscribe();
        previousProfileRef.current = null;
    };
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

function CallProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useUser();
    const firestore = useFirestore();

    const [incomingCall, setIncomingCall] = useState<Call | null>(null);
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [outgoingCall, setOutgoingCall] = useState<(Omit<Call, 'id' | 'timestamp' | 'participants'| 'status' | 'direction' > & { callId?: string }) | null>(null);
    const callListenerUnsubscribe = useRef<() => void | null>(null);
    
    const endCall = useCallback(async () => {
        const callIdToDelete = incomingCall?.id || outgoingCall?.callId || activeCall?.id;
        
        setIncomingCall(null);
        setActiveCall(null);
        setOutgoingCall(null);

        if (firestore && callIdToDelete) {
            try {
                await deleteDoc(doc(firestore, 'calls', callIdToDelete));
            } catch (error) {
                console.warn("Could not delete call doc, it might already be gone:", error);
            }
        }
    }, [incomingCall, outgoingCall, activeCall, firestore]);

    // Central listener for all call documents related to the current user
    useEffect(() => {
        if (!user || !firestore || authLoading) return;
        
        // Cleanup previous listener if user changes
        if (callListenerUnsubscribe.current) {
            callListenerUnsubscribe.current();
            callListenerUnsubscribe.current = null;
        }

        const callsRef = collection(firestore, 'calls');
        const q = query(callsRef, where('participants', 'array-contains', user.uid), limit(1));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                // No call documents found, ensure all local states are cleared.
                endCall();
                return;
            }

            const callData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Call;
            
            // If the call is answered, set it as active and clear others.
            if (callData.status === 'answered' && callData.answeredAt) {
                setIncomingCall(null);
                setOutgoingCall(null);
                setActiveCall(callData);
                return;
            }

            // If the call is outgoing
            if (callData.status === 'outgoing') {
                if (callData.callerId === user.uid) {
                    // I am the caller
                    setIncomingCall(null);
                    setActiveCall(null);
                    setOutgoingCall({
                        callerId: callData.callerId,
                        receiverId: callData.receiverId,
                        type: callData.type,
                        callId: callData.id,
                    });
                } else {
                    // I am the receiver
                    setOutgoingCall(null);
                    setActiveCall(null);
                    setIncomingCall(callData);
                }
                return;
            }
        }, (error) => {
            console.error("Call listener error:", error);
            endCall();
        });

        callListenerUnsubscribe.current = unsubscribe;

        return () => {
            if (callListenerUnsubscribe.current) {
                callListenerUnsubscribe.current();
            }
        };
    }, [user, firestore, authLoading, endCall]);

    const startCall = useCallback(async (receiverId: string, type: 'audio' | 'video') => {
        if (!firestore || !user || activeCall || outgoingCall || incomingCall) {
            console.warn("Cannot start call: existing call in progress or user not ready.");
            return;
        }

        const newCallData = {
            callerId: user.uid,
            receiverId: receiverId,
            participants: [user.uid, receiverId],
            type: type,
            status: 'outgoing' as const, 
            timestamp: serverTimestamp(),
        };
    
        try {
            // Add the document. The listener will automatically pick it up and set the outgoingCall state.
            await addDoc(collection(firestore, 'calls'), newCallData);
        } catch (error) {
            console.error('Error initiating call:', error);
        }
    }, [firestore, user, activeCall, outgoingCall, incomingCall]);
    
    const acceptCall = useCallback(async (call: Call) => {
        if (!firestore) return;
        const callDocRef = doc(firestore, 'calls', call.id);
        try {
            await updateDoc(callDocRef, { 
                status: 'answered',
                answeredAt: serverTimestamp() 
            });
            // The listener will handle the state transition to activeCall
        } catch (e) {
            console.error("Error accepting call: ", e);
            endCall(); // Clean up state if accept fails
        }
    }, [firestore, endCall]);

    const declineCall = useCallback(async (call: Call) => {
        // Just end the call, which deletes the document. This is the signal for decline.
        endCall();
    }, [endCall]);


    const contextValue = {
        activeCall,
        outgoingCall,
        incomingCall,
        startCall,
        acceptCall,
        declineCall,
        endCall
    };
    
    const renderCallScreen = () => {
        // The active call screen takes highest priority
        if (activeCall) {
            return <div className="fixed inset-0 z-[1001]"><ActiveCallPage /></div>;
        }
        // Then outgoing
        if (outgoingCall) {
            return <div className="fixed inset-0 z-[1001]"><OutgoingCallPage /></div>;
        }
        // Then incoming
        if (incomingCall) {
            return <IncomingCall call={incomingCall} />;
        }
        return null;
    }

    return (
        <CallContext.Provider value={contextValue}>
            {renderCallScreen()}
            {children}
        </CallContext.Provider>
    );
}

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

function ChatAppLayout({
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
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists()) {
            const batch = writeBatch(firestore);
            batch.delete(memberRef);
        
            if (memberDoc.exists() && (memberDoc.data() as UserProfile).micSlot !== -1) {
                const roomDoc = await getDoc(roomRef);
                if (roomDoc.exists() && roomDoc.data().memberCount > 0) {
                  batch.update(roomRef, { memberCount: -1 });
                }
            }
            await batch.commit();
        }
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
          playRequestSound.play();
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
                        <span className={"truncate text-sm font-medium"}>
                            {applyNameColor(profile?.displayName ?? 'User', profile?.nameColor)}
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

export default function ChatAppLayoutWithProvider({ children }: { children: React.ReactNode }) {
    return (
        <CallProvider>
            <ChatAppLayout>{children}</ChatAppLayout>
        </CallProvider>
    );
}
