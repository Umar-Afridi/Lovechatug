'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Phone,
  Video,
  MoreVertical,
  Trash2,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, onSnapshot, doc, getDocs, writeBatch, orderBy, Unsubscribe } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile, Call } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';


interface CallWithUser extends Call {
  otherUser?: UserProfile;
}

const CallItem = ({ call }: { call: CallWithUser }) => {
  const { user } = useUser();
  if (!user || !call.otherUser) return null;

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  const CallStatusIcon = ({ direction, status }: { direction: string, status: string }) => {
    const className = status === 'missed' || status === 'declined' ? 'text-destructive' : 'text-muted-foreground';
    if (direction === 'incoming') {
      return <PhoneIncoming className={className + " h-4 w-4"} />
    }
    return <PhoneOutgoing className={className + " h-4 w-4"} />
  }
  
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate();
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        return '';
    }
  }

  const getCallDescription = (call: Call) => {
    const directionText = call.direction === 'incoming' ? 'Incoming' : 'Outgoing';
    const statusText = call.status.charAt(0).toUpperCase() + call.status.slice(1);
    return `${directionText} ${call.type} call - ${statusText}`;
  }

  return (
     <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
                <AvatarImage src={call.otherUser?.photoURL} />
                <AvatarFallback>{getInitials(call.otherUser?.displayName)}</AvatarFallback>
            </Avatar>
            <div>
                <p className={`font-semibold ${call.status === 'missed' || call.status === 'declined' ? 'text-destructive' : ''}`}>
                    {call.otherUser?.displayName}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CallStatusIcon direction={call.direction} status={call.status} />
                    {formatTimestamp(call.timestamp)}
                </p>
            </div>
        </div>
        <Button variant="ghost" size="icon">
            {call.type === 'video' ? <Video className="h-5 w-5 text-primary" /> : <Phone className="h-5 w-5 text-primary" />}
        </Button>
    </div>
  )
}

export default function CallsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [calls, setCalls] = useState<CallWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleClearAll = async () => {
    if (!firestore || !user || calls.length === 0) return;

    const batch = writeBatch(firestore);
    calls.forEach(call => {
        // We need to delete calls where user is either caller or receiver
        const callRef = doc(firestore, 'calls', call.id);
        batch.delete(callRef);
    });

    try {
        await batch.commit();
        toast({
          title: 'Call History Cleared',
          description: 'All your call records have been deleted.',
        });
    } catch(error) {
        console.error("Error clearing call history: ", error);
        const permissionError = new FirestorePermissionError({ path: 'calls', operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            title: 'Error',
            description: 'Could not clear call history.',
            variant: 'destructive',
        });
    } finally {
        setClearAllDialogOpen(false);
    }
  };
  
  const processCallDocs = useCallback(async (
    callDocs: any[],
    currentUserUid: string,
    userProfilesMap: Map<string, UserProfile>
  ): Promise<CallWithUser[]> => {
    
    const otherUserIds = [
      ...new Set(callDocs.flatMap(call => [call.callerId, call.receiverId]))
    ].filter(uid => uid !== currentUserUid && !userProfilesMap.has(uid));

    if (otherUserIds.length > 0 && firestore) {
      const usersRef = collection(firestore, 'users');
      // Firestore 'in' query can handle up to 30 items. For more, you'd need to chunk the requests.
      const chunks = [];
      for (let i = 0; i < otherUserIds.length; i += 30) {
        chunks.push(otherUserIds.slice(i, i + 30));
      }
      
      try {
        const userPromises = chunks.map(chunk => getDocs(query(usersRef, where('uid', 'in', chunk))));
        const userSnapshots = await Promise.all(userPromises);
        userSnapshots.forEach(snapshot => {
          snapshot.forEach(doc => {
            userProfilesMap.set(doc.data().uid, doc.data() as UserProfile);
          });
        });
      } catch (e) {
        const permissionError = new FirestorePermissionError({ path: usersRef.path, operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
      }
    }
    
    return callDocs.map(call => {
      const otherUserId = call.callerId === currentUserUid ? call.receiverId : call.callerId;
      return {
        ...call,
        otherUser: userProfilesMap.get(otherUserId),
        // Determine direction based on who is viewing the history
        direction: call.callerId === currentUserUid ? 'outgoing' : 'incoming',
      };
    }).filter(call => call.otherUser) as CallWithUser[];

  }, [firestore]);


  useEffect(() => {
    if (!user || !user.uid || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const callsRef = collection(firestore, 'calls');
    
    // This query MUST exactly match the composite index defined in firestore.indexes.json
    // 1. Where clause on 'participants'
    // 2. OrderBy clause on 'timestamp'
    const q = query(
        callsRef, 
        where('participants', 'array-contains', user.uid),
        orderBy('timestamp', 'desc')
    );
    
    const userProfiles = new Map<string, UserProfile>();

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const populatedCalls = await processCallDocs(docs, user.uid, userProfiles);
        setCalls(populatedCalls);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching call history:", error);
        // This could be a permission error or an index error if the query changes.
        const permissionError = new FirestorePermissionError({ path: `calls query for user ${user.uid}`, operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();

  }, [user, firestore, processCallDocs]);
  

  return (
    <>
      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your call history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              Yes, clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-bold">Call History</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setClearAllDialogOpen(true)} className="text-destructive" disabled={calls.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Clear all call history</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p>Loading call history...</p>
            </div>
          ) : calls.length > 0 ? (
            <div className="p-4 space-y-2">
                {calls.map((call, index) => (
                    <React.Fragment key={call.id}>
                        <CallItem call={call} />
                        {index < calls.length - 1 && <Separator />}
                    </React.Fragment>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <PhoneMissed className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold">No Call History</h2>
                <p className="text-muted-foreground mt-2">
                You haven't made or received any calls yet.
                </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
