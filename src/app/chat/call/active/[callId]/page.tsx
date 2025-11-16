'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, deleteDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';
import type { UserProfile, Call } from '@/lib/types';
import { useCallContext } from '@/app/chat/layout';


export default function ActiveCallPage() {
  const { activeCall, endCall } = useCallContext();
  const router = useRouter();

  // Redirect if there's no active call in context
  useEffect(() => {
    if (!activeCall) {
      router.push('/chat');
    }
  }, [activeCall, router]);

  const callId = activeCall?.id;
  const callData = activeCall;

  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hangupInitiated = useRef(false);

  useEffect(() => {
    if (!callData || !firestore || !authUser) return;
    
    let isMounted = true;

    // Start the timer
    if (!intervalRef.current) {
        let startTime = new Date().getTime();
        // Check if answeredAt is a valid Firestore Timestamp object
        if (callData.answeredAt && typeof callData.answeredAt.toDate === 'function') {
            startTime = callData.answeredAt.toDate().getTime();
        }
        
        intervalRef.current = setInterval(() => {
            const now = new Date().getTime();
            const durationInSeconds = Math.floor((now - startTime) / 1000);
            setCallDuration(durationInSeconds);
        }, 1000);
    }
    
    // Fetch other user's data
    const otherUserId = callData.callerId === authUser.uid ? callData.receiverId : callData.callerId;
    const userDocRef = doc(firestore, 'users', otherUserId);
    
    getDoc(userDocRef).then(userDocSnap => {
         if (isMounted) {
            if (userDocSnap.exists()) {
              setOtherUser(userDocSnap.data() as UserProfile);
            } else {
              // Other user doc doesn't exist, something is wrong, end the call
              handleHangUp();
            }
         }
    });

    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callData, firestore, authUser]);


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

  const handleHangUp = async () => {
    if (hangupInitiated.current) return;
    hangupInitiated.current = true;

    // Stop the timer locally first
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
    
    // Use the context's endCall function which will also update Firestore
    endCall();

    if (firestore && callData && authUser) {
        const finalDuration = callDuration;
        
        // Add a message to the chat about the call
        const chatId = [callData.callerId, callData.receiverId].sort().join('_');
        const messagesRef = collection(firestore, `chats/${chatId}/messages`);
        try {
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
        } catch (e) {
            console.error("Failed to add call-end message to chat", e);
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
          onClick={handleHangUp}
        >
          <PhoneOff className="h-8 w-8" />
          <span className="sr-only">Hang Up</span>
        </Button>
      </div>
    </div>
  );
}
