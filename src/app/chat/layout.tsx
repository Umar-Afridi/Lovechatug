'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { getDatabase, ref, onValue, off, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { IncomingCall } from '@/components/chat/incoming-call';
import type { Call, UserProfile } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/firebase/provider';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Phone, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


// --- Bottom Navigation ---
function BottomNavBar() {
    const pathname = usePathname();
    const { user } = useUser();
    const firestore = useFirestore();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadFriends, setUnreadFriends] = useState(0);

    useEffect(() => {
        if (!user || !firestore) return;
        
        const chatsQuery = query(collection(firestore, 'chats'), where('members', 'array-contains', user.uid));
        const chatsUnsub = onSnapshot(chatsQuery, (snapshot) => {
            let total = 0;
            snapshot.forEach(doc => {
                total += doc.data().unreadCount?.[user.uid] || 0;
            });
            setUnreadMessages(total);
        });

        const friendsQuery = query(collection(firestore, 'friendRequests'), where('receiverId', '==', user.uid), where('status', '==', 'pending'));
        const friendsUnsub = onSnapshot(friendsQuery, (snapshot) => {
            setUnreadFriends(snapshot.size);
        });
        
        return () => {
            chatsUnsub();
            friendsUnsub();
        };

    }, [user, firestore]);
    
    const navItems = [
        { href: '/chat/rooms', emoji: '🏠', label: 'Rooms', count: 0 },
        { href: '/chat', emoji: '📥', label: 'Inbox', count: unreadMessages },
        { href: '/chat/calls', icon: Phone, label: 'Calls', count: 0 },
        { href: '/chat/friends', icon: UserPlus, label: 'Friends', count: unreadFriends },
        { href: '/profile', emoji: '👤', label: 'Me', count: 0 },
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-sm">
            <nav className="flex items-center justify-around h-16">
                {navItems.map(item => {
                    const isActive = pathname === item.href;
                    return (
                        <Link href={item.href} key={item.label} className={cn("flex flex-col items-center justify-center text-xs gap-1 transition-colors w-1/5", isActive ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                           <div className="relative text-2xl">
                                {item.emoji ? (
                                    <span>{item.emoji}</span>
                                ) : (
                                    item.icon && <item.icon className="h-6 w-6" />
                                )}
                                {item.count > 0 && <Badge variant="destructive" className="absolute -top-1 -right-2 h-4 w-4 justify-center p-0 text-xs">{item.count}</Badge>}
                            </div>
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </footer>
    );
}


// --- Presence Management ---
function usePresence() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (!user || !firestore || authLoading) return;

    const db = getDatabase();
    const userStatusDatabaseRef = ref(db, '/status/' + user.uid);
    const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
    const connectedRef = ref(db, '.info/connected');

    const onValueChange = onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        await set(userStatusDatabaseRef, { isOnline: true, lastSeen: rtdbServerTimestamp() });
        
        await updateDoc(userStatusFirestoreRef, { isOnline: true, lastSeen: serverTimestamp() });

        onDisconnect(userStatusDatabaseRef).set({ isOnline: false, lastSeen: rtdbServerTimestamp() });
      }
    });

    return () => {
      off(connectedRef, 'value', onValueChange);
    };
  }, [user, firestore, authLoading]);
}

// --- Disabled Account Handling ---
function useAccountDisabledHandling() {
    const auth = useAuth();
    const router = useRouter();
    const { user, loading: authLoading } = useUser();
    const firestore = useFirestore();
    const [isAccountDisabled, setAccountDisabled] = useState(false);

    useEffect(() => {
        if (authLoading || !user || !firestore) return;

        const userDocRef = doc(firestore, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                if (data.isDisabled) {
                    setAccountDisabled(true);
                }
            }
        });
        return () => unsubscribe();
    }, [authLoading, user, firestore]);

    const handleConfirmDisabled = async () => {
        if (auth) {
            await auth.signOut();
            router.push('/');
        }
    };
    
    return { isAccountDisabled, handleConfirmDisabled };
}

// --- Call Management ---
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

function CallProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();

    const [incomingCall, setIncomingCall] = useState<Call | null>(null);
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [outgoingCall, setOutgoingCall] = useState<(Omit<Call, 'id' | 'timestamp' | 'participants'| 'status' | 'direction' > & { callId?: string }) | null>(null);
    const callListenerUnsubscribe = useRef<() => void | null>(null);
    
    const endCall = useCallback(async () => {
        const callIdToDelete = incomingCall?.id || outgoingCall?.callId || activeCall?.id;
        
        setIncomingCall(null);
        setActiveCall(null);
        setOutgoingCall(null);
        
        if (pathname && pathname.startsWith('/chat/call/')) {
            router.push('/chat');
        }

        if (firestore && callIdToDelete) {
            try {
                await deleteDoc(doc(firestore, 'calls', callIdToDelete));
            } catch (error) {
                console.warn("Could not delete call doc, it might already be gone:", error);
            }
        }
    }, [incomingCall, outgoingCall, activeCall, firestore, router, pathname]);

    useEffect(() => {
        if (!user || !firestore || authLoading) return;
        
        if (callListenerUnsubscribe.current) {
            callListenerUnsubscribe.current();
            callListenerUnsubscribe.current = null;
        }

        const callsRef = collection(firestore, 'calls');
        const q = query(callsRef, where('participants', 'array-contains', user.uid), limit(1));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                endCall();
                return;
            }

            const callData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Call;
            
            if (callData.status === 'answered' && callData.answeredAt) {
                setIncomingCall(null);
                setOutgoingCall(null);
                setActiveCall(callData);
                if (!pathname.startsWith('/chat/call/active/')) {
                    router.push(`/chat/call/active/${callData.id}`);
                }
                return;
            }

            if (callData.status === 'outgoing') {
                if (callData.callerId === user.uid) {
                    setIncomingCall(null);
                    setActiveCall(null);
                    setOutgoingCall({
                        callerId: callData.callerId,
                        receiverId: callData.receiverId,
                        type: callData.type,
                        callId: callData.id,
                    });
                     if (!pathname.startsWith('/chat/call/outgoing/')) {
                        router.push(`/chat/call/outgoing/${callData.receiverId}`);
                    }
                } else {
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
    }, [user, firestore, authLoading, endCall, router, pathname]);

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
        } catch (e) {
            console.error("Error accepting call: ", e);
            endCall();
        }
    }, [firestore, endCall]);

    const declineCall = useCallback(async (call: Call) => {
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
    
    return (
        <CallContext.Provider value={contextValue}>
            {incomingCall && <IncomingCall call={incomingCall} />}
            {children}
        </CallContext.Provider>
    );
}

// --- Main Layout ---
export default function ChatAppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  usePresence();
  const { isAccountDisabled, handleConfirmDisabled } = useAccountDisabledHandling();

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
  
   if (authLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (!user && (pathname.startsWith('/chat') || pathname.startsWith('/profile') || pathname.startsWith('/settings'))) {
      return <div className="flex h-screen w-full items-center justify-center">Redirecting...</div>;
  }
  
  if (!user) {
      return <>{children}</>;
  }

  // Hide BottomNav on specific routes like active call or chat details
  const showBottomNav = !pathname.includes('/chat/') && !pathname.startsWith('/chat/call');

  return (
    <CallProvider>
        <AlertDialog open={isAccountDisabled}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Account Disabled</AlertDialogTitle>
              <AlertDialogDescription>
                Your account has been disabled by an administrator. You will be logged out.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleConfirmDisabled}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <main className="pb-16">{children}</main>
        {showBottomNav && <BottomNavBar />}
    </CallProvider>
  );
}
