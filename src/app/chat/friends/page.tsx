'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, onSnapshot, getDocs, writeBatch, setDoc, serverTimestamp, getDoc as getDocNonRealTime, addDoc, or } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UserProfile, FriendRequest as FriendRequestType } from '@/lib/types';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, Settings, Bell, X, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';


interface FriendRequestWithUser extends FriendRequestType {
    id: string;
    fromUser?: UserProfile;
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

const FriendRequestsList = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [requests, setRequests] = useState<FriendRequestWithUser[]>([]);
    const [loading, setLoading] = useState(true);
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

        const requestsQuery = query(
            collection(firestore, 'friendRequests'), 
            where('receiverId', '==', user.uid), 
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(requestsQuery, async (querySnapshot) => {
            if (querySnapshot.empty) {
                setRequests([]);
                setLoading(false);
                return;
            }

            const requestsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequestWithUser));
            
            const senderIds = [...new Set(requestsData.map(req => req.senderId))].filter(Boolean);
            
            if (senderIds.length > 0) {
                const usersRef = collection(firestore, 'users');
                const usersQuery = query(usersRef, where('uid', 'in', senderIds));
                
                try {
                const usersSnapshot = await getDocs(usersQuery);
                const userProfiles = new Map(usersSnapshot.docs.map(doc => [doc.data().uid, doc.data() as UserProfile]));
                
                const populatedRequests = requestsData.map(req => ({
                    ...req,
                    fromUser: userProfiles.get(req.senderId)
                }));
                
                setRequests(populatedRequests);
                } catch (userError) {
                    console.error("Error fetching sender profiles: ", userError);
                }

            } else {
                setRequests([]);
            }

            setLoading(false);

        }, (error) => {
            console.error("Error fetching friend requests:", error);
            setLoading(false);
        });

        return () => unsubscribe();

    }, [user, firestore]);

    const handleAccept = async (request: FriendRequestWithUser) => {
        if (!firestore || !user || !request.fromUser) return;
        
        const requestRef = doc(firestore, 'friendRequests', request.id);
        const currentUserRef = doc(firestore, 'users', user.uid);
        const friendUserRef = doc(firestore, 'users', request.senderId);
        
        const chatId = [user.uid, request.senderId].sort().join('_');
        const chatRef = doc(firestore, 'chats', chatId);

        try {
            const batch = writeBatch(firestore);

            batch.update(currentUserRef, { 
                friends: arrayUnion(request.senderId),
                chatIds: arrayUnion(chatId) 
            });
            batch.update(friendUserRef, { 
                friends: arrayUnion(user.uid),
                chatIds: arrayUnion(chatId)
            });
            
            const chatSnap = await getDocNonRealTime(chatRef);
            if (!chatSnap.exists()) {
                const currentUserProfile = (await getDocNonRealTime(currentUserRef)).data() as UserProfile;
                batch.set(chatRef, {
                    members: [user.uid, request.senderId],
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    participantDetails: {
                        [user.uid]: {
                        displayName: currentUserProfile?.displayName || user.displayName,
                        photoURL: currentUserProfile?.photoURL || user.photoURL,
                        },
                        [request.senderId]: {
                        displayName: request.fromUser.displayName,
                        photoURL: request.fromUser.photoURL,
                        },
                    },
                    unreadCount: { [user.uid]: 0, [request.senderId]: 0 },
                    typing: { [user.uid]: false, [request.senderId]: false }
                });
            }

            batch.delete(requestRef);

            await batch.commit();

            toast({ title: 'Friend Added!', description: `You are now friends with ${request.fromUser.displayName}.` });
        } catch (error: any) {
            toast({ title: 'Error', description: 'Could not accept friend request.', variant: 'destructive'});
            console.error("Error accepting friend request:", error);
        }
    };

    const handleDecline = async (requestId: string) => {
        if (!firestore) return;
        const requestRef = doc(firestore, 'friendRequests', requestId);
        try {
            await deleteDoc(requestRef);
            toast({ title: 'Request Declined' });
        } catch (error) {
            console.error("Error declining friend request:", error);
            toast({ title: 'Error', description: 'Could not decline friend request.', variant: 'destructive' });
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground"><p>Loading requests...</p></div>;
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground p-8 text-center">
                <UserPlus className="h-16 w-16 mb-4" />
                <h2 className="text-xl font-semibold">No Friend Requests</h2>
                <p>When someone sends you a friend request, it will appear here.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Friend Requests</h2>
            {requests.map(request => (
                request.fromUser && (
                    <div key={request.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar>
                                    <AvatarImage src={request.fromUser.photoURL} />
                                    <AvatarFallback>{getInitials(request.fromUser.displayName)}</AvatarFallback>
                                </Avatar>
                                {request.fromUser.officialBadge?.isOfficial && (
                                    <div className="absolute bottom-0 right-0">
                                        <OfficialBadge color={request.fromUser.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={request.fromUser.canManageOfficials} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className={"font-semibold"}>
                                      {applyNameColor(request.fromUser.displayName ?? 'Loading...', request.fromUser.nameColor)}
                                    </p>
                                    {request.fromUser.verifiedBadge?.showBadge && (
                                        <VerifiedBadge color={request.fromUser.verifiedBadge.badgeColor} />
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">@{request.fromUser.username ?? '...'}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleAccept(request)} disabled={!request.fromUser}>Accept</Button>
                            <Button size="sm" variant="outline" onClick={() => handleDecline(request.id)}>Decline</Button>
                        </div>
                    </div>
                )
            ))}
        </div>
    );
}

export default function FriendsPage() {
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const { user } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestType[]>([]);
  const { toast } = useToast();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
  };

  useEffect(() => {
    if (!user || !firestore) return;
    
    const unsubProfile = onSnapshot(doc(firestore, 'users', user.uid), (doc) => {
        setProfile(doc.data() as UserProfile);
    });

    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
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
        unsubscribeNotifications();
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
      // Using 'or' to query both username and displayName is not directly supported for complex queries.
      // A client-side merge of two separate queries is a common pattern.
      
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
        const [usernameSnapshot, displayNameSnapshot] = await Promise.all([getDocs(usernameQuery), getDocs(displayNameQuery)]);
        const resultsMap = new Map<string, UserProfile>();

        usernameSnapshot.forEach((doc) => {
            resultsMap.set(doc.id, doc.data() as UserProfile);
        });
        displayNameSnapshot.forEach((doc) => {
            resultsMap.set(doc.id, doc.data() as UserProfile);
        });
            
          const myBlockedList = profile.blockedUsers || [];
          const whoBlockedMe = profile.blockedBy || [];
          const myFriends = profile.friends || [];

          const finalResults = Array.from(resultsMap.values()).filter(u => 
                u.uid !== user.uid && // Not myself
                !u.isDisabled && // Not disabled
                !myBlockedList.includes(u.uid) && // Not blocked by me
                !whoBlockedMe.includes(u.uid) // Not blocking me
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
                                <Button asChild size="sm" variant="secondary" disabled>
                                    <span>Friends</span>
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
    return <FriendRequestsList />;
  };
  
  return (
    <div className="flex h-full flex-col bg-background">
         <div className="p-4 space-y-4 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>Friends</span>
            </h1>
            <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setIsSearching(prev => !prev)}>
                    <Search className="h-5 w-5" />
                    <span className="sr-only">Search</span>
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
                    placeholder="Search by username or display name..." 
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
        <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
        </div>
    </div>
  );
}
