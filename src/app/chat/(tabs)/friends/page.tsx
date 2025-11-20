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
import { cn, applyNameColor } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, Settings, Bell, X, UserPlus, Check, MessageSquare, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useSound } from '@/hooks/use-sound';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallContext } from '../../layout';


interface FriendRequestWithUser extends FriendRequestType {
    id: string;
    fromUser?: UserProfile;
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
                const userProfiles = new Map<string, UserProfile>();
                const usersRef = collection(firestore, 'users');
                
                // Batch fetching user profiles to improve performance
                for (let i = 0; i < senderIds.length; i += 10) {
                    const chunk = senderIds.slice(i, i + 10);
                    if (chunk.length > 0) {
                        const usersQuery = query(usersRef, where('uid', 'in', chunk));
                        const usersSnapshot = await getDocs(usersQuery);
                        usersSnapshot.forEach(doc => {
                            userProfiles.set(doc.id, doc.data() as UserProfile);
                        });
                    }
                }

                const populatedRequests = requestsData.map(req => ({
                    ...req,
                    fromUser: userProfiles.get(req.senderId)
                })).filter(req => req.fromUser);
                
                setRequests(populatedRequests);
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
            
            // Get current user's profile data to create chat
            const currentUserSnap = await getDocNonRealTime(currentUserRef);
            if (!currentUserSnap.exists()) {
                throw new Error("Current user profile not found.");
            }
            const currentUserProfile = currentUserSnap.data() as UserProfile;

            // 1. Update friends arrays for both users
            batch.update(currentUserRef, { friends: arrayUnion(request.senderId) });
            batch.update(friendUserRef, { friends: arrayUnion(user.uid) });
            
            // 2. Create the chat document if it doesn't exist
            const chatSnap = await getDocNonRealTime(chatRef);
            if (!chatSnap.exists()) {
                batch.set(chatRef, {
                    members: [user.uid, request.senderId],
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    participantDetails: {
                        [user.uid]: {
                            displayName: currentUserProfile?.displayName || 'User',
                            photoURL: currentUserProfile?.photoURL || '',
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

            // 3. Delete the friend request
            batch.delete(requestRef);

            // 4. Commit all operations at once
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
  const { openSearch } = useCallContext();

  useEffect(() => {
    if (!user || !firestore) return;
    
    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
    });

    return () => {
        unsubscribeNotifications();
    };

  }, [user, firestore]);
  
  return (
    <div className="flex h-full flex-col bg-background">
         <div className="p-4 space-y-4 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>Friends</span>
            </h1>
            <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={openSearch}>
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
        </div>
        <ScrollArea className="flex-1 flex flex-col overflow-hidden">
            <FriendRequestsList />
        </ScrollArea>
    </div>
  );
}
