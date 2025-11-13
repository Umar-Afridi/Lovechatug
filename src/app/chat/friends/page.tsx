'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, onSnapshot, getDocs, writeBatch, setDoc, serverTimestamp, getDoc as getDocNonRealTime } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile, FriendRequest as FriendRequestType } from '@/lib/types';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { cn } from '@/lib/utils';

interface FriendRequestWithUser extends FriendRequestType {
    id: string;
    fromUser?: UserProfile;
}

export default function FriendsPage() {
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
  
  const requestsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'friendRequests'), 
        where('receiverId', '==', user.uid), 
        where('status', '==', 'pending')
    );
  }, [user, firestore]);
  
  useEffect(() => {
    if (!requestsQuery || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);

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
              const permissionError = new FirestorePermissionError({
                  path: usersRef.path,
                  operation: 'list',
              });
              errorEmitter.emit('permission-error', permissionError);
            }

        } else {
            setRequests([]);
        }

        setLoading(false);

    }, (serverError: any) => {
        const permissionError = new FirestorePermissionError({
            path: 'friendRequests',
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();

  }, [requestsQuery, firestore]);

  const handleAccept = async (request: FriendRequestWithUser) => {
    if (!firestore || !user || !request.fromUser) return;
    
    const requestRef = doc(firestore, 'friendRequests', request.id);
    const currentUserRef = doc(firestore, 'users', user.uid);
    const friendUserRef = doc(firestore, 'users', request.senderId);
    
    const chatId = [user.uid, request.senderId].sort().join('_');
    const chatRef = doc(firestore, 'chats', chatId);

    try {
        const batch = writeBatch(firestore);

        // Use set with merge to avoid "No document to update" errors
        batch.set(currentUserRef, { friends: arrayUnion(request.senderId), chatIds: arrayUnion(chatId) }, { merge: true });
        batch.set(friendUserRef, { friends: arrayUnion(user.uid), chatIds: arrayUnion(chatId) }, { merge: true });
        
        // Use a non-realtime get to avoid conflicts with listeners
        const currentUserSnap = await getDocNonRealTime(currentUserRef);
        const friendUserSnap = await getDocNonRealTime(friendUserRef);
        
        const currentUserProfile = currentUserSnap.data() as UserProfile;
        const friendUserProfile = friendUserSnap.data() as UserProfile;
        
        if (!currentUserProfile || !friendUserProfile) {
            // Even if profiles are incomplete, we create them on the fly now with set merge.
            // Let's ensure we have basic details for the chat participant list.
            console.warn("One of the user profiles was missing, but proceeding.");
        }

        batch.set(chatRef, {
          members: [user.uid, request.senderId],
          participants: [user.uid, request.senderId], // For security rules
          createdAt: serverTimestamp(),
          participantDetails: {
            [user.uid]: {
              displayName: currentUserProfile?.displayName || user.displayName,
              photoURL: currentUserProfile?.photoURL || user.photoURL,
            },
            [request.senderId]: {
              displayName: friendUserProfile?.displayName || request.fromUser.displayName,
              photoURL: friendUserProfile?.photoURL || request.fromUser.photoURL,
            },
          },
        });

        batch.delete(requestRef);

        await batch.commit();

        toast({ title: 'Friend Added!', description: `You are now friends with ${request.fromUser.displayName}.` });
    } catch (error: any) {
        console.error("Error accepting friend request: ", error);
        if (error.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: `batch write operation for friend accept`,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                title: 'Error',
                description: 'Could not accept friend request. Please try again later.',
                variant: 'destructive',
            });
        }
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'friendRequests', requestId);
    deleteDoc(requestRef)
        .then(() => {
            toast({ title: 'Request Declined' });
        })
        .catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: requestRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground"><p>Loading requests...</p></div>;
  }

  if (requests.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground"><p>No new friend requests.</p></div>;
  }
  
  return (
    <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Friend Requests</h1>
            {requests.map(request => (
                <div key={request.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                        <Avatar>
                            <AvatarImage src={request.fromUser?.photoURL} />
                            <AvatarFallback>{getInitials(request.fromUser?.displayName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-center gap-2">
                                {request.fromUser?.officialBadge?.isOfficial && (
                                    <OfficialBadge color={request.fromUser.officialBadge.badgeColor} />
                                )}
                                <p className={cn(
                                  "font-semibold",
                                  request.fromUser?.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                                )}>
                                  {request.fromUser?.displayName ?? 'Loading...'}
                                </p>
                                {request.fromUser?.verifiedBadge?.showBadge && (
                                    <VerifiedBadge color={request.fromUser.verifiedBadge.badgeColor} />
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">@{request.fromUser?.username ?? '...'}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAccept(request)} disabled={!request.fromUser}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDecline(request.id)}>Decline</Button>
                    </div>
                </div>
            ))}
        </div>
    </ScrollArea>
  );
}
