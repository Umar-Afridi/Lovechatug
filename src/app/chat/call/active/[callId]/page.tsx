'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
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
  const startTimeRef = useRef<Date | null>(null);


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
            startTimeRef.current = data.timestamp.toDate();
            intervalRef.current = setInterval(() => {
                setCallDuration(differenceInSeconds(new Date(), startTimeRef.current!));
            }, 1000);
        }

        // Fetch the other user's profile if we haven't already
        if (!otherUser && authUser) {
          const otherUserId = data.callerId === authUser.uid ? data.receiverId : data.callerId;
          const userDoc = onSnapshot(doc(firestore, 'users', otherUserId), (userSnap) => {
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

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(seconds.toString().padStart(2, '0'));
    
    return parts.join(':');
  }

  const handleHangUp = async () => {
    if (!firestore || !callId || !callData || !authUser) {
      router.back();
      return;
    }
    
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }

    const callDocRef = doc(firestore, 'calls', callId);
    const finalDuration = callDuration;

    try {
        // Update the call document with the final duration and status
        await updateDoc(callDocRef, { 
            duration: finalDuration,
            status: 'answered' // Keep status as answered to log it correctly
        });

        // Add a message to the chat
        const chatId = [callData.callerId, callData.receiverId].sort().join('_');
        const messagesRef = collection(firestore, `chats/${chatId}/messages`);
        await addDoc(messagesRef, {
            senderId: authUser.uid,
            type: 'call',
            content: 'Call ended',
            timestamp: serverTimestamp(),
            status: 'sent',
            callInfo: {
                type: callData.type,
                duration: formatDuration(finalDuration),
                status: 'answered'
            }
        });

        // The caller is responsible for deleting the document after a short delay
        // to ensure the receiver gets the update.
        if (callData.callerId === authUser?.uid) {
            setTimeout(async () => {
                await deleteDoc(callDocRef);
            }, 5000); // 5-second delay
        }

    } catch (error) {
        console.error("Error hanging up call:", error);
    } finally {
        router.back();
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
  };

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
