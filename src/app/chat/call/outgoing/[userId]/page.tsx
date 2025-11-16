'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { outgoingCall, endCall } = useCallContext();
  
  // This page should not be rendered if there is no outgoing call
  useEffect(() => {
    if (!outgoingCall) {
      router.push('/chat');
    }
  }, [outgoingCall, router]);
  
  const otherUserId = params.userId as string;
  const callId = outgoingCall?.callId; 

  const firestore = useFirestore();
  const { user } = useUser();
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callStatusText, setCallStatusText] = useState('Ringing...');
  const [loading, setLoading] = useState(true);

  const { play, stop } = useSound('https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/Ringing.mp3?alt=media&token=24075f11-715d-4a57-9bf4-1594adaa995e', { loop: true });

  // Fetch receiver's profile
  useEffect(() => {
    if (!firestore || !otherUserId) return;
    let isMounted = true;
    
    const userDocRef = doc(firestore, 'users', otherUserId);
    
    getDoc(userDocRef).then(docSnap => {
        if (!isMounted) return;
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setOtherUser(userData);
            play(); // Start ringing only after confirming user exists
        } else {
            setCallStatusText('User not found');
            setTimeout(() => endCall(), 1500);
        }
        setLoading(false);
    }).catch(() => {
        if (!isMounted) return;
        setCallStatusText('Error reaching user');
        setLoading(false);
        setTimeout(() => endCall(), 1500);
    });

    return () => {
      isMounted = false;
      stop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, otherUserId, endCall]);
  
  // This effect listens for the call document to change or disappear.
  // It's the primary way the caller knows if the call was answered, declined, or timed out.
   useEffect(() => {
    if (!firestore || !callId) return;

    const callDocRef = doc(firestore, 'calls', callId);
    const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
      if (!docSnap.exists()) {
        // The document was deleted. This means the call was declined, cancelled by the caller, or timed out.
        // The active call state will be cleared by the main layout listener.
        // We just need to stop the sound here.
        stop();
        // The redirection will be handled by the main layout effect that checks for outgoingCall
        return;
      }

      const callData = docSnap.data() as Call;
      // If the call status changes to "declined", show a message and hang up.
      if (callData.status === 'declined') {
        setCallStatusText('Call Declined');
        stop();
        // The document will be deleted by the receiver, and the !docSnap.exists() case will trigger.
      }
      // If the call is answered, the main layout listener will handle transitioning to the active call screen.
    });

    return () => {
        unsubscribe();
        stop();
    };
  }, [firestore, callId, stop]);


  const handleHangUp = useCallback(() => {
    // This function is only for the caller to cancel the call.
    // It simply tells the context to end the call, which handles deleting the Firestore doc.
    stop();
    endCall();
  }, [stop, endCall]);
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  if (loading || !otherUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        <p>{loading ? 'Preparing call...' : callStatusText}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-between bg-gray-900 text-white p-8 animate-in fade-in-0">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <Avatar className="h-32 w-32 border-4 border-gray-600">
        <AvatarImage src={otherUser.photoURL} />
        <AvatarFallback className="text-5xl bg-gray-700">
            {getInitials(otherUser.displayName)}
        </AvatarFallback>
        </Avatar>
        <h1 className="text-4xl font-bold">{otherUser.displayName}</h1>
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
