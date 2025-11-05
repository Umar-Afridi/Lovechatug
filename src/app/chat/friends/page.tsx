'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, arrayUnion } from 'firebase/firestore';
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

  useEffect(() => {
    if (!user || !firestore) return;

    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(requestsRef, where('to', '==', user.uid), where('status', '==', 'pending'));

    const fetchRequests = async () => {
        try {
            const querySnapshot = await getDocs(q);
            const requestsData: FriendRequest[] = [];
            for (const docSnap of querySnapshot.docs) {
                const request = { id: docSnap.id, ...docSnap.data() } as FriendRequest;
                
                // Fetch sender's profile
                const userRef = doc(firestore, 'users', request.from);
                const userSnap = await getDoc(userRef);
                if(userSnap.exists()){
                    request.fromUser = userSnap.data() as UserProfile;
                }
                requestsData.push(request);
            }
            setRequests(requestsData);
        } catch (serverError) {
            const permissionError = new FirestorePermissionError({
                path: requestsRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setLoading(false);
        }
    };
    
    fetchRequests();

  }, [user, firestore]);

  const handleAccept = async (request: FriendRequest) => {
    if (!firestore || !user) return;
    
    const requestRef = doc(firestore, 'friendRequests', request.id);
    const currentUserRef = doc(firestore, 'users', user.uid);
    const friendUserRef = doc(firestore, 'users', request.from);

    try {
        // Update request status
        await updateDoc(requestRef, { status: 'accepted' });

        // Add each user to the other's friend list
        await updateDoc(currentUserRef, { friends: arrayUnion(request.from) });
        await updateDoc(friendUserRef, { friends: arrayUnion(user.uid) });
        
        toast({ title: 'Friend Added!', description: `You are now friends with ${request.fromUser?.displayName}.` });
        setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch(err: any) {
        console.error("Error accepting friend request:", err);
        toast({ title: 'Error', description: 'Could not accept friend request.', variant: 'destructive' });
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'friendRequests', requestId);
    try {
        // You can either delete the request or set its status to 'rejected'
        await deleteDoc(requestRef);
        toast({ title: 'Request Declined' });
        setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch(err: any) {
        console.error("Error declining friend request:", err);
        toast({ title: 'Error', description: 'Could not decline friend request.', variant: 'destructive' });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
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
