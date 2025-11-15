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
import { useToast } from '@/hooks/use-toast';


export default function ActiveCallPage() {
  const params = useParams();
  const callId = params.callId as string;
  const router = useRouter();
  const { toast } = useToast();

  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const [callData, setCallData] = useState<Call | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hangupInitiated = useRef(false);


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
        
        if (data.status !== 'answered') {
           toast({ title: 'Call Ended', description: 'The call was not answered or has ended.', variant: 'destructive'});
           handleHangUp(true);
           return;
        }
        
        // Start the timer only once
        if (!intervalRef.current) {
            intervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        }

        if (!otherUser) {
          const otherUserId = data.callerId === authUser.uid ? data.receiverId : data.callerId;
          const userDocSnap = await getDoc(doc(firestore, 'users', otherUserId));
          if (userDocSnap.exists()) {
              setOtherUser(userDocSnap.data() as UserProfile);
          } else {
              // Other user doc doesn't exist, something is wrong, end the call
              handleHangUp(false);
          }
        }
      } else {
        // Call doc was deleted, meaning the call is over.
        handleHangUp(true);
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, callId, authUser, otherUser]);

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
    // Prevent multiple hangup calls
    if (hangupInitiated.current) return;
    hangupInitiated.current = true;

    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
    
    // If this client is the one ending the call, update Firestore
    if (!isRemoteHangup && firestore && callId && callData && authUser) {
        const finalDuration = callDuration;
        const callDocRef = doc(firestore, 'calls', callId);
        
        try {
            await updateDoc(callDocRef, { 
                status: 'ended', // Signal to other user to hang up
                duration: finalDuration,
            });
           
            // Add call log message to chat
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
            
            // The original caller is responsible for cleaning up the call document.
            if (callData.callerId === authUser.uid) {
                setTimeout(async () => {
                     try {
                         await deleteDoc(callDocRef);
                     } catch (e) {
                         // It might already be deleted by a rapid sequence of events, that's fine.
                         console.warn("Could not delete call document, it might already be gone.", e);
                     }
                }, 3000); // 3-second delay
            }

        } catch (error) {
            console.error("Error hanging up call:", error);
        }
    }
    
     // We don't navigate back anymore, the incoming call component will just disappear
     // And this component will unmount because the parent layout will no longer render it
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
