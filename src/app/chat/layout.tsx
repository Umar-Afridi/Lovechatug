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
import { UserPlus, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react'
import type { EmblaCarouselType } from 'embla-carousel'
import RoomsPage from './(tabs)/rooms/page';
import InboxPage from './(tabs)/inbox/page';
import CallsPage from './(tabs)/calls/page';
import FriendsPage from './(tabs)/friends/page';
import ProfilePage from './(tabs)/profile/page';


const TABS = ['/chat/rooms', '/chat/inbox', '/chat/calls', '/chat/friends', '/chat/profile'];
const TAB_EMOJIS = ['🏠', '📥', '📞', null, '👤'];
const TAB_ICONS = [null, null, null, UserPlus, null];
const TAB_LABELS = ['Rooms', 'Inbox', 'Calls', 'Friends', 'Me'];


// --- Bottom Navigation ---
function BottomNavBar({ emblaApi }: { emblaApi: EmblaCarouselType | undefined }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadFriends, setUnreadFriends] = useState(0);
    const [activeIndex, setActiveIndex] = useState(1); // Default to inbox

    const onNavClick = useCallback((index: number) => {
        if (emblaApi) {
            emblaApi.scrollTo(index);
        }
    }, [emblaApi]);

    const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
        setActiveIndex(emblaApi.selectedScrollSnap());
    }, []);

    useEffect(() => {
        if (!emblaApi) return;
        
        onSelect(emblaApi);
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);

        return () => { emblaApi.off('select', onSelect) };
    }, [emblaApi, onSelect]);


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
    
     const unreadCounts = [0, unreadMessages, 0, unreadFriends, 0];

    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-sm">
            <nav className="flex items-center justify-around h-16">
                {TABS.map((href, index) => {
                    const isActive = activeIndex === index;
                    const Icon = TAB_ICONS[index];
                    return (
                        <button
                            key={href} 
                            className={cn("flex flex-col items-center justify-center text-xs gap-1 transition-colors w-1/5", isActive ? "text-primary" : "text-muted-foreground hover:text-primary")}
                            onClick={() => onNavClick(index)}
                        >
                           <div className="relative text-2xl">
                                {TAB_EMOJIS[index] ? (
                                    <span>{TAB_EMOJIS[index]}</span>
                                ) : (
                                    Icon && <Icon className="h-6 w-6" />
                                )}
                                {unreadCounts[index] > 0 && <Badge variant="destructive" className="absolute -top-1 -right-2 h-4 w-4 justify-center p-0 text-xs">{unreadCounts[index]}</Badge>}
                            </div>
                            <span className="text-xs">{TAB_LABELS[index]}</span>
                        </button>
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
type OutgoingCall = { callId?: string; callerId: string; receiverId: string; type: "audio" | "video" };

interface CallContextType {
  activeCall: Call | null;
  outgoingCall: OutgoingCall | null;
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
    const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null);
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
export default function ChatAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, watchDrag: true, startIndex: 1, align: 'start' });
  
  usePresence();
  const { isAccountDisabled, handleConfirmDisabled } = useAccountDisabledHandling();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        if (pathname === '/' || pathname === '/signup') {
          router.replace('/chat/inbox');
        }
      } else {
        if (!['/', '/signup'].includes(pathname) && !pathname.startsWith('/admin')) {
          router.replace('/');
        }
      }
    }
  }, [authLoading, user, pathname, router]);

  // Sync carousel to URL changes from outside (e.g. browser back/forward)
  useEffect(() => {
    if (!emblaApi) return;
    const tabIndex = TABS.indexOf(pathname);
    if (tabIndex !== -1 && tabIndex !== emblaApi.selectedScrollSnap()) {
        emblaApi.scrollTo(tabIndex, true); // Use true for instant scroll to avoid animation
    }
  }, [pathname, emblaApi]);
  
   if (authLoading) {
    return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
  }

  // If user is not logged in and not on an auth page, show nothing (or a loader)
  if (!user && !['/', '/signup'].includes(pathname)) {
    return null;
  }
  
  const isNonTabLayout = (
    pathname.startsWith('/chat/') && !TABS.includes(pathname) || 
    pathname.startsWith('/admin') ||
    pathname.startsWith('/prop-house') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/profile')
  );

  if (isNonTabLayout) {
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
                <main>{children}</main>
            </CallProvider>
      )
  }

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
        <div className="h-[calc(100svh-4rem)] embla" ref={emblaRef}>
            <div className="embla__container h-full">
                <div className="embla__slide"><RoomsPage /></div>
                <div className="embla__slide"><InboxPage /></div>
                <div className="embla__slide"><CallsPage /></div>
                <div className="embla__slide"><FriendsPage /></div>
                <div className="embla__slide"><ProfilePage /></div>
            </div>
        </div>
        <BottomNavBar emblaApi={emblaApi} />
    </CallProvider>
  );
}
