'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';
import type { UserProfile, Call } from '@/lib/types';
import { differenceInSeconds } from 'date-fns';

export default function ActiveCallPage() {
  const params = useParams();
  const callId = params.callId as string;
  const router = useRouter();

  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const [callData, setCallData] = useState<Call | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!firestore || !callId) return;

    const callDocRef = doc(firestore, 'calls', callId);

    const unsubscribe = onSnapshot(callDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Call;
        setCallData(data);

        // If status is no longer 'answered', end the call.
        if (data.status !== 'answered') {
          router.back();
          return;
        }
        
        // Start timer if it's not already running
        if (!intervalRef.current && data.timestamp) {
            const startTime = data.timestamp.toDate();
            intervalRef.current = setInterval(() => {
                setCallDuration(differenceInSeconds(new Date(), startTime));
            }, 1000);
        }

        // Fetch the other user's profile if we haven't already
        if (!otherUser && authUser) {
          const otherUserId = data.callerId === authUser.uid ? data.receiverId : data.callerId;
          const userDoc = await onSnapshot(doc(firestore, 'users', otherUserId), (userSnap) => {
              if (userSnap.exists()) {
                  setOtherUser(userSnap.data() as UserProfile);
              }
          });
        }
      } else {
        // Call doc was deleted, end the call
        router.back();
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [firestore, callId, authUser, otherUser, router]);

  const handleHangUp = async () => {
    if (!firestore || !callId || !callData) {
      router.back();
      return;
    }

    const callDocRef = doc(firestore, 'calls', callId);
    
    // Check if the current user is the caller. If so, they are responsible for deleting the doc.
    if (callData.callerId === authUser?.uid) {
        try {
            await deleteDoc(callDocRef);
        } catch (error) {
            console.error("Error deleting call document:", error);
        }
    } else {
        // If the receiver hangs up, they just update the status.
        // The caller will then see this and delete the doc.
        try {
            await updateDoc(callDocRef, { status: 'declined' }); // A status to signify hangup
        } catch(error) {
            console.error("Error updating call status:", error);
        }
    }
    
    // In all cases, the user who hangs up goes back.
    router.back();
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  if (!otherUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        <p>Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-between bg-gray-900 text-white p-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <Avatar className="h-32 w-32 border-4 border-green-500">
          <AvatarImage src={otherUser.photoURL} />
          <AvatarFallback className="text-5xl bg-gray-700">
            {getInitials(otherUser.displayName)}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-4xl font-bold">{otherUser.displayName}</h1>
        <p className="text-lg text-gray-400 font-mono tracking-wider">{formatDuration(callDuration)}</p>
      </div>

      <div className="flex items-center justify-center">
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full h-20 w-20 bg-red-600 hover:bg-red-700"
          onClick={handleHangUp}
        >
          <PhoneOff className="h-8 w-8" />
          <span className="sr-only">Hang Up</span>
        </Button>
      </div>
    </div>
  );
}
