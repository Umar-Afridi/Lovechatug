'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, addDoc, collection, getDoc, Timestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';
import type { UserProfile, Call } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useCallContext } from '@/app/chat/layout';


export default function ActiveCallPage() {
  const { activeCall, endCall } = useCallContext();
  const callData = activeCall;
  const callId = activeCall?.id;

  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hangupInitiated = useRef(false);

  useEffect(() => {
    if (!callData) return;

    // Start the timer only once
    if (!intervalRef.current) {
        let startTime = new Date().getTime();
        // If there is a timestamp, use it. Otherwise, assume call just started.
        if (callData.answeredAt) {
            const answeredAt = callData.answeredAt;
            // Check if it's a Firestore Timestamp object before calling .toDate()
            if (answeredAt && typeof answeredAt.toDate === 'function') {
                startTime = answeredAt.toDate().getTime();
            }
        }
        
        intervalRef.current = setInterval(() => {
            const now = new Date().getTime();
            const durationInSeconds = Math.floor((now - startTime) / 1000);
            setCallDuration(durationInSeconds);
        }, 1000);
    }
    
    // Fetch other user's data if not already fetched
    if (!otherUser && authUser) {
        const otherUserId = callData.callerId === authUser.uid ? callData.receiverId : callData.callerId;
        const userDocRef = doc(firestore, 'users', otherUserId);
        getDoc(userDocRef).then(userDocSnap => {
             if (userDocSnap.exists()) {
              setOtherUser(userDocSnap.data() as UserProfile);
            } else {
              // Other user doc doesn't exist, something is wrong, end the call
              handleHangUp(false);
            }
        });
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callData, firestore, authUser, otherUser]);


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
    if (hangupInitiated.current) return;
    hangupInitiated.current = true;

    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
    
    endCall();

    if (!isRemoteHangup && firestore && callId && callData && authUser) {
        const finalDuration = callDuration;
        const callDocRef = doc(firestore, 'calls', callId);
        
        try {
            await updateDoc(callDocRef, { 
                status: 'ended', 
                duration: finalDuration,
            });
           
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
            
            if (callData.callerId === authUser.uid) {
                setTimeout(async () => {
                     try { await deleteDoc(callDocRef); } catch (e) {
                         console.warn("Could not delete call document, it might already be gone.", e);
                     }
                }, 3000);
            }

        } catch (error) {
            console.error("Error hanging up call:", error);
        }
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
  };

  if (!otherUser || !callData) {
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
