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
  getDocs,
  or,
} from 'firebase/firestore';
import { getDatabase, ref, onValue, off, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { IncomingCall } from '@/components/chat/incoming-call';
import type { Call, UserProfile, FriendRequest as FriendRequestType } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/firebase/provider';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Tv, Home, Search, X, MessageSquare, Clock, Settings, Bell, MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, applyNameColor } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react'
import type { EmblaCarouselType } from 'embla-carousel'
import RoomsPage from './(tabs)/rooms/page';
import InboxPage from './(tabs)/inbox/page';
import CallsPage from './(tabs)/calls/page';
import FriendsPage from './(tabs)/friends/page';
import ProfilePage from './(tabs)/profile/page';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { useSound } from '@/hooks/use-sound';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

// --- Global Search Component ---
const GlobalSearch = ({ on_close }: { on_close: () => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendRequestType[]>([]);
    const { play: playSendRequestSound } = useSound('https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/sound/short_click.mp3');

    const getInitials = (name: string | null | undefined) => {
        if (!name) return 'U';
        return name.split(' ').map((n) => n[0]).join('');
    };

    useEffect(() => {
        if (!user || !firestore) return;
        
        const unsubProfile = onSnapshot(doc(firestore, 'users', user.uid), (doc) => {
            setProfile(doc.data() as UserProfile);
        });

        const sentRequestsRef = collection(firestore, 'friendRequests');
        const qSent = query(sentRequestsRef, where('senderId', '==', user.uid), where('status', '==', 'pending'));
        const unsubSent = onSnapshot(qSent, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequestType));
            setSentRequests(requests);
        });

        return () => {
            unsubProfile();
            unsubSent();
        };

    }, [user, firestore]);

    const handleSearch = useCallback(async (queryText: string) => {
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

                usernameSnapshot.forEach((doc) => {
                    const userData = doc.data() as UserProfile;
                     if (userData.username.toLowerCase().startsWith(queryLower)) {
                        resultsMap.set(doc.id, userData);
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
        }, [firestore, user, profile, toast]);

    const handleSendRequest = (receiverId: string) => {
        if (!firestore || !user) return;
        const requestsRef = collection(firestore, 'friendRequests');
        const newRequest = {
            senderId: user.uid,
            receiverId: receiverId,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
        };
        
        addDoc(requestsRef, newRequest).then(() => {
             playSendRequestSound();
             toast({ title: 'Request Sent', description: 'Your friend request has been sent.'});
        }).catch((serverError: any) => {
            const permissionError = new FirestorePermissionError({
                path: 'friendRequests',
                operation: 'create',
                requestResourceData: newRequest,
            }, serverError);
            errorEmitter.emit('permission-error', permissionError);
        })
    };
    
    const handleCancelRequest = async (receiverId: string) => {
        if (!firestore || !user) return;
        
        const q = query(
            collection(firestore, 'friendRequests'),
            where('senderId', '==', user.uid),
            where('receiverId', '==', receiverId)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const docToDelete = querySnapshot.docs[0];
            deleteDoc(docToDelete.ref)
                .then(() => {
                    toast({ title: 'Request Cancelled' });
                })
                .catch((serverError: any) => {
                    const permissionError = new FirestorePermissionError({
                        path: docToDelete.ref.path,
                        operation: 'delete',
                    }, serverError);
                    errorEmitter.emit('permission-error', permissionError);
                });
        }
    }

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in-0">
             <header className="p-4 flex items-center gap-2 border-b">
                 <Input 
                    placeholder="Search by username..." 
                    className="pl-10 h-10"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                />
                <Search className="absolute left-7 h-5 w-5 text-muted-foreground" />
                <Button variant="ghost" onClick={on_close}>Cancel</Button>
            </header>
            <ScrollArea className="flex-1">
                {searchResults.length === 0 && searchQuery.length > 1 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <p>No users found for "{searchQuery}".</p>
                    </div>
                ) : searchResults.length > 0 ? (
                    searchResults.map(foundUser => {
                        const isFriend = profile?.friends?.includes(foundUser.uid);
                        const hasSentRequest = sentRequests.some(req => req.receiverId === foundUser.uid);
                        
                        return (
                            <div key={foundUser.uid} className="flex items-center justify-between p-4 hover:bg-muted/50">
                                <div className="flex items-center gap-4 overflow-hidden">
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
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold truncate">
                                                {applyNameColor(foundUser.displayName, foundUser.nameColor)}
                                            </p>
                                            {foundUser.verifiedBadge?.showBadge && (
                                                <VerifiedBadge color={foundUser.verifiedBadge.badgeColor} />
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">@{foundUser.username}</p>
                                    </div>
                                </div>
                                 {isFriend ? (
                                    <Button size="sm" variant="secondary" onClick={() => { on_close(); router.push(`/chat/${foundUser.uid}`); }}>
                                        <MessageSquare className="mr-2 h-4 w-4"/>
                                        Message
                                    </Button>
                                ) : hasSentRequest ? (
                                    <Button size="sm" variant="outline" onClick={() => handleCancelRequest(foundUser.uid)}>
                                        <Clock className="mr-2 h-4 w-4"/>
                                        Sent
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={() => handleSendRequest(foundUser.uid)}>
                                        <UserPlus className="mr-2 h-4 w-4"/>
                                        Add
                                    </Button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="p-8 text-center text-muted-foreground">
                        <p>Find people by their username.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

const TABS = ['/chat/rooms', '/chat/inbox', '/chat/calls', '/chat/friends', '/chat/profile'];
const TAB_ICONS = [Home, null, null, null, null];
const TAB_EMOJIS = [null, '📥', '📞', '👥', '👤'];
const TAB_LABELS = ['𝐑𝐨𝐨𝐦𝐬', '𝐈𝐧𝐛𝐨𝐱', '𝐂𝐚𝐥𝐥𝐬', '𝐅𝐫𝐢𝐞𝐧𝐝𝐬', '𝐌𝐞'];
const TAB_TITLES = ['Rooms', 'Love Chat', 'Call History', 'Friends', 'Me'];


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
  openSearch: () => void;
  isClearAllCallsDialogOpen: boolean;
  setClearAllCallsDialogOpen: (open: boolean) => void;
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

    const [isSearchOpen, setSearchOpen] = useState(false);
    const [isClearAllCallsDialogOpen, setClearAllCallsDialogOpen] = useState(false);
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
        endCall,
        openSearch: () => setSearchOpen(true),
        isClearAllCallsDialogOpen,
        setClearAllCallsDialogOpen,
    };
    
    return (
        <CallContext.Provider value={contextValue}>
            {isSearchOpen && <GlobalSearch on_close={() => setSearchOpen(false)} />}
            {incomingCall && <IncomingCall call={incomingCall} />}
            {children}
        </CallContext.Provider>
    );
}

// --- Main Layout Component ---
function ChatAppLayoutContent({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useUser();
    const router = useRouter();
    const pathname = usePathname();
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: false,
        watchDrag: true,
        startIndex: 1,
        align: 'start',
    });
    const [activeIndex, setActiveIndex] = useState(1);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const { openSearch, setClearAllCallsDialogOpen } = useCallContext();

    const { firestore } = useFirestore();

    usePresence();
    const { isAccountDisabled, handleConfirmDisabled } = useAccountDisabledHandling();

    const onSelect = useCallback(
        (emblaApi: EmblaCarouselType) => {
            const newIndex = emblaApi.selectedScrollSnap();
            setActiveIndex(newIndex);
            const newPath = TABS[newIndex];
            if (newPath && newPath !== pathname) {
                // This will only update the URL without a full page reload
                // which is what we want for a smooth carousel experience
                window.history.replaceState(null, '', newPath);
            }
        },
        [pathname]
    );
    
     const onNavClick = useCallback((index: number) => {
        if (emblaApi) {
            emblaApi.scrollTo(index);
        }
    }, [emblaApi]);


    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        
        const tabIndex = TABS.indexOf(pathname);
        if (tabIndex !== -1 && tabIndex !== emblaApi.selectedScrollSnap()) {
            emblaApi.scrollTo(tabIndex, true); // Use snap: true for instant jump
        }

        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect, pathname]);


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

    useEffect(() => {
        if (!user || !firestore) return;

        const notificationsRef = collection(
            firestore,
            'users',
            user.uid,
            'notifications'
        );
        const qNotifications = query(
            notificationsRef,
            where('isRead', '==', false)
        );
        const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
            setUnreadNotificationCount(snapshot.size);
        });

        return () => {
            unsubscribeNotifications();
        };
    }, [user, firestore]);

    if (authLoading) {
        return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
    }

    const isNonTabLayout =
        pathname.startsWith('/chat/') &&
        !TABS.includes(pathname) ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/prop-house') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/profile');

    if (isNonTabLayout) {
        return (
            <>
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
            </>
        )
    }

    const currentTitle = TAB_TITLES[activeIndex] || 'Chat';

    return (
        <>
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

            <header className="fixed top-0 left-0 right-0 flex items-center justify-between p-4 border-b bg-background/95 z-20">
                <h1 className={cn("text-2xl font-bold", currentTitle === 'Love Chat' && 'text-primary')}>{currentTitle}</h1>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={openSearch}
                    >
                        <Search className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-10 w-10 rounded-full"
                        asChild
                    >
                        <Link href="/chat/notifications">
                            <Bell className="h-5 w-5" />
                            {unreadNotificationCount > 0 && (
                                <Badge
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0"
                                >
                                    {unreadNotificationCount}
                                </Badge>
                            )}
                            <span className="sr-only">Notifications</span>
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        asChild
                    >
                        <Link href="/settings">
                            <Settings className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="h-[calc(100svh-4rem)] pt-[64px] overflow-hidden">
                <div className="embla h-full" ref={emblaRef}>
                    <div className="embla__container h-full">
                        <div className="embla__slide"><RoomsPage /></div>
                        <div className="embla__slide"><InboxPage /></div>
                        <div className="embla__slide"><CallsPage /></div>
                        <div className="embla__slide"><FriendsPage /></div>
                        <div className="embla__slide"><ProfilePage /></div>
                    </div>
                </div>
            </main>

            <BottomNavBar emblaApi={emblaApi} />
        </>
    );
}


// --- Final Layout Export ---
export default function ChatAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return (
        <CallProvider>
            <ChatAppLayoutContent>
                {children}
            </ChatAppLayoutContent>
        </CallProvider>
    )
}
