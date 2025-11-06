'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, arrayUnion, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile } from '@/lib/types';


interface FriendRequest {
    id: string;
    from: string;
    status: 'pending' | 'accepted' | 'rejected';
    fromUser?: UserProfile;
}

export default function FriendsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
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
    };

    setLoading(true);
    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(requestsRef, where('to', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const requestsData = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FriendRequest));
        
        if (requestsData.length === 0) {
            setRequests([]);
            setLoading(false);
            return;
        }

        // Optimized fetching of user profiles
        const senderIds = requestsData.map(req => req.from);
        const usersRef = collection(firestore, 'users');
        const usersQuery = query(usersRef, where('uid', 'in', senderIds));
        
        try {
            const usersSnapshot = await getDocs(usersQuery);
            const sendersMap = new Map<string, UserProfile>();
            usersSnapshot.forEach(docSnap => {
                sendersMap.set(docSnap.id, docSnap.data() as UserProfile);
            });

            const requestsWithUsers = requestsData.map(request => ({
                ...request,
                fromUser: sendersMap.get(request.from)
            }));
            
            setRequests(requestsWithUsers);
        } catch (usersError) {
             console.error("Error fetching request senders:", usersError);
             // Still show requests even if profiles fail to load
             setRequests(requestsData);
        }

        setLoading(false);

    }, (serverError: any) => {
        const permissionError = new FirestorePermissionError({
            path: requestsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();

  }, [user, firestore]);

  const handleAccept = async (request: FriendRequest) => {
    if (!firestore || !user) return;
    
    const requestRef = doc(firestore, 'friendRequests', request.id);
    const currentUserRef = doc(firestore, 'users', user.uid);
    const friendUserRef = doc(firestore, 'users', request.from);

    try {
        // In a real production app, use batched writes or a transaction for atomicity.
        
        // 1. Update request status to 'accepted'
        await updateDoc(requestRef, { status: 'accepted' });

        // 2. Add each user to the other's friend list
        await updateDoc(currentUserRef, { friends: arrayUnion(request.from) });
        await updateDoc(friendUserRef, { friends: arrayUnion(user.uid) });
        
        toast({ title: 'Friend Added!', description: `You are now friends with ${request.fromUser?.displayName}.` });
        // The list will update automatically due to the onSnapshot listener
    } catch(err: any) {
        console.error("Error accepting friend request:", err);
        // More specific error handling could be added here
        toast({ title: 'Error', description: 'Could not accept friend request.', variant: 'destructive' });
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'friendRequests', requestId);
    try {
        // You can either delete the request or set its status to 'rejected'
        // Setting to rejected can be useful for tracking, but for this app, we'll delete it.
        await deleteDoc(requestRef);
        toast({ title: 'Request Declined' });
         // The list will update automatically due to the onSnapshot listener
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
                            <p className="font-semibold">{request.fromUser?.displayName}</p>
                            <p className="text-sm text-muted-foreground">@{request.fromUser?.username}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAccept(request)}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDecline(request.id)}>Decline</Button>
                    </div>
                </div>
            ))}
        </div>
    </ScrollArea>
  );
}
