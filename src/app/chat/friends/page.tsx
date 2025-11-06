'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile, FriendRequest as FriendRequestType } from '@/lib/types';

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
  
  useEffect(() => {
    if (!user || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(requestsRef, where('to', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const requestsData: FriendRequestWithUser[] = [];
        const userProfileUnsubscribers: (() => void)[] = [];

        if (querySnapshot.empty) {
            setRequests([]);
            setLoading(false);
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const request = { id: docSnap.id, ...docSnap.data() } as FriendRequestWithUser;
            requestsData.push(request);

            const userDocRef = doc(firestore, 'users', request.from);
            const unsub = onSnapshot(userDocRef, (userSnap) => {
                if (userSnap.exists()) {
                    request.fromUser = userSnap.data() as UserProfile;
                }
                // This will cause a re-render with the user data
                setRequests([...requestsData]);
            });
            userProfileUnsubscribers.push(unsub);
        });

        setRequests(requestsData);
        setLoading(false);

        // Clean up user profile listeners when the component unmounts or query changes
        return () => {
            userProfileUnsubscribers.forEach(unsub => unsub());
        };
    }, (serverError: any) => {
        console.error("Error fetching friend requests:", serverError);
        const permissionError = new FirestorePermissionError({
            path: requestsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();

  }, [user, firestore]);

  const handleAccept = async (request: FriendRequestWithUser) => {
    if (!firestore || !user || !request.fromUser) return;
    
    const requestRef = doc(firestore, 'friendRequests', request.id);
    const currentUserRef = doc(firestore, 'users', user.uid);
    const friendUserRef = doc(firestore, 'users', request.from);

    try {
        // Use batched writes or a transaction for atomicity in a real app
        await updateDoc(requestRef, { status: 'accepted' });
        await updateDoc(currentUserRef, { friends: arrayUnion(request.from) });
        await updateDoc(friendUserRef, { friends: arrayUnion(user.uid) });
        
        toast({ title: 'Friend Added!', description: `You are now friends with ${request.fromUser.displayName}.` });
    } catch(err: any) {
        console.error("Error accepting friend request:", err);
        toast({ title: 'Error', description: 'Could not accept friend request.', variant: 'destructive' });
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'friendRequests', requestId);
    try {
        await deleteDoc(requestRef);
        toast({ title: 'Request Declined' });
    } catch(err: any) {
        console.error("Error declining friend request:", err);
        toast({ title: 'Error', description: 'Could not decline friend request.', variant: 'destructive' });
    }
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
                            <p className="font-semibold">{request.fromUser?.displayName ?? 'Loading...'}</p>
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
