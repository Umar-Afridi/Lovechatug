'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, deleteDoc, getDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';
import type { UserProfile, Call } from '@/lib/types';
import { useSound } from '@/hooks/use-sound';
import { useCallContext } from '@/app/chat/layout';

export default function OutgoingCallPage() {
  const params = useParams();
  const otherUserId = params.userId as string;
  const { outgoingCall, endCall } = useCallContext();
  const callId = outgoingCall?.callId; // Get callId from context

  const firestore = useFirestore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callStatusText, setCallStatusText] = useState('Ringing...');
  const [loading, setLoading] = useState(true);

  const { play, stop } = useSound('https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/Ringing.mp3?alt=media&token=24075f11-715d-4a57-9bf4-1594adaa995e', { loop: true });


  // Fetch receiver's profile
  useEffect(() => {
    if (!firestore || !otherUserId) return;
    
    setLoading(true);
    const userDocRef = doc(firestore, 'users', otherUserId);
    
    getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setOtherUser(userData);
            play();
        } else {
            // User not found, automatically hang up.
            setCallStatusText('User not found');
            setTimeout(handleHangUp, 1500);
        }
    }).catch(() => {
        setCallStatusText('Error reaching user');
        setTimeout(handleHangUp, 1500);
    }).finally(() => {
        setLoading(false); 
    });

    // Also listen for real-time changes to the user's online status
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserProfile;
        setOtherUser(userData);
        if (callStatusText === 'Ringing...' && !userData.isOnline) {
            setCallStatusText('Unavailable');
        }
      }
    });

    return () => {
      stop();
      unsubscribe();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, otherUserId]);

  // Listen to call document for status changes
  useEffect(() => {
    if (!firestore || !callId) return;
    
    const callDocRef = doc(firestore, 'calls', callId);
    const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Call;
         // The transition to 'answered' is handled by the layout's central listener
        if (data.status === 'declined') {
            setCallStatusText('Call Declined');
            stop();
            setTimeout(handleHangUp, 1500);
        }
      } else {
        // Document was deleted (call was cancelled, declined, or ended)
        endCall();
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, callId]);


  const handleHangUp = useCallback(async () => {
    stop();
    if (!firestore || !callId) {
      endCall(); 
      return;
    }
    const callDocRef = doc(firestore, 'calls', callId);
    try {
       // Deleting the doc is the signal for all parties to end the call
       await deleteDoc(callDocRef);
    } catch (error) {
      console.warn("Could not delete call doc, it might already be gone:", error);
    } finally {
       endCall(); // This will clean up local state and unmount the component
    }
  }, [stop, endCall, firestore, callId]);
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        <p>Preparing call...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-between bg-gray-900 text-white p-8 animate-in fade-in-0">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        {otherUser ? (
            <>
                <Avatar className="h-32 w-32 border-4 border-gray-600">
                <AvatarImage src={otherUser.photoURL} />
                <AvatarFallback className="text-5xl bg-gray-700">
                    {getInitials(otherUser.displayName)}
                </AvatarFallback>
                </Avatar>
                <h1 className="text-4xl font-bold">{otherUser.displayName}</h1>
            </>
        ) : (
             <div className="h-32 w-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-gray-600">
                <p className="text-5xl">?</p>
             </div>
        )}
        <p className="text-lg text-gray-400">{callStatusText}</p>
      </div>

      <div className="flex items-center justify-center">
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full h-20 w-20 bg-red-600 hover:bg-red-700"
          onClick={handleHangUp}
        >
          <PhoneOff className="h-8 w-8" />
          <span className="sr-only">Cancel Call</span>
        </Button>
      </div>
    </div>
  );
}
