'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, addDoc, collection, getDoc } from 'firebase/firestore';
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
    if (!firestore || !callId || !authUser) return;

    const callDocRef = doc(firestore, 'calls', callId);

    const unsubscribe = onSnapshot(callDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Call;
        setCallData(data);

        // If status is 'ended', it means the other user hung up.
        if (data.status === 'ended') {
          handleHangUp(true); // Call hangup logic without updating doc again
          return;
        }
        
        // If status is not 'answered' when we land here, something is wrong.
        if (data.status !== 'answered') {
          router.back();
          return;
        }
        
        if (!intervalRef.current && data.timestamp) {
            startTimeRef.current = data.timestamp.toDate();
            setCallDuration(differenceInSeconds(new Date(), startTimeRef.current!));
            intervalRef.current = setInterval(() => {
                if (startTimeRef.current) {
                  setCallDuration(differenceInSeconds(new Date(), startTimeRef.current));
                }
            }, 1000);
        }

        if (!otherUser) {
          const otherUserId = data.callerId === authUser.uid ? data.receiverId : data.callerId;
          const userDocSnap = await getDoc(doc(firestore, 'users', otherUserId));
          if (userDocSnap.exists()) {
              setOtherUser(userDocSnap.data() as UserProfile);
          }
        }
      } else {
        router.back(); // Call doc was deleted
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
    if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(seconds.toString().padStart(2, '0'));
    
    return parts.join(':');
  }

  const handleHangUp = async (isRemoteHangup = false) => {
    if (!firestore || !callId || !callData || !authUser) {
      router.back();
      return;
    }
    
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }

    const finalDuration = callDuration;
    
    // Prevent recursive updates or double operations
    if (callData.status === 'ended' && !isRemoteHangup) {
      router.back();
      return;
    }

    try {
        if (!isRemoteHangup) {
            const callDocRef = doc(firestore, 'calls', callId);
            await updateDoc(callDocRef, { 
                status: 'ended', // Signal to other user to hang up
                duration: finalDuration,
            });
        }
       
        // Both users will try to add this, but it's okay due to Firestore's behavior
        const chatId = [callData.callerId, callData.receiverId].sort().join('_');
        const messagesRef = collection(firestore, `chats/${chatId}/messages`);
        
        // Let's ensure the message is only added once by the person who initiated hangup
        if (!isRemoteHangup) {
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
        }
        
        // The original caller is responsible for cleaning up the call document.
        if (callData.callerId === authUser.uid) {
            setTimeout(async () => {
                 try {
                     await deleteDoc(doc(firestore, 'calls', callId));
                 } catch (e) {
                     // It might already be deleted by a rapid sequence of events, that's fine.
                     console.warn("Could not delete call document, it might already be gone.", e);
                 }
            }, 3000); // 3-second delay
        }

    } catch (error) {
        console.error("Error hanging up call:", error);
    } finally {
        if (router) {
          router.back();
        }
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
          onClick={() => handleHangUp(false)}
        >
          <PhoneOff className="h-8 w-8" />
          <span className="sr-only">Hang Up</span>
        </Button>
      </div>
    </div>
  );
}
