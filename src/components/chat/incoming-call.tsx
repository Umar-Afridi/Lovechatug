'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import type { UserProfile, Call } from '@/lib/types';
import { useSound } from '@/hooks/use-sound';

interface IncomingCallProps {
  call: Call;
  onHandled: () => void;
  onAccept: (call: Call) => void;
}

export function IncomingCall({ call, onHandled, onAccept }: IncomingCallProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const [caller, setCaller] = useState<UserProfile | null>(null);

  const { play: playIncomingCallSound, stop: stopIncomingCallSound } = useSound('https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/Ringing.mp3?alt=media&token=24075f11-715d-4a57-9bf4-1594adaa995e', { loop: true });


  useEffect(() => {
    playIncomingCallSound();
    return () => {
      stopIncomingCallSound();
    };
  }, [playIncomingCallSound, stopIncomingCallSound]);
  
  useEffect(() => {
    if (!firestore || !call.callerId) return;

    const callerDocRef = doc(firestore, 'users', call.callerId);
    getDoc(callerDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        setCaller(docSnap.data() as UserProfile);
      } else {
        handleDecline();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, call.callerId]);

  const handleAccept = async () => {
    stopIncomingCallSound();
    if (!firestore || !call.id) return;
    const callDocRef = doc(firestore, 'calls', call.id);
    try {
        await updateDoc(callDocRef, { status: 'answered', answeredAt: serverTimestamp() });
        onAccept(call);
    } catch(e) {
        console.error("Error accepting call: ", e);
        onHandled();
    }
  };

  const handleDecline = async () => {
    stopIncomingCallSound();
    if (!firestore || !call.id) return;
    const callDocRef = doc(firestore, 'calls', call.id);
    try {
        await updateDoc(callDocRef, { status: 'declined' });
    } catch (e) {
        console.error("Error declining call: ", e);
    } finally {
        onHandled();
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
  };

  if (!caller) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-between bg-gray-900/95 text-white p-8 backdrop-blur-sm">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <p className="text-lg text-gray-400">Incoming Call...</p>
        <Avatar className="h-32 w-32 border-4 border-gray-600">
          <AvatarImage src={caller.photoURL} />
          <AvatarFallback className="text-5xl bg-gray-700">
            {getInitials(caller.displayName)}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-4xl font-bold">{caller.displayName}</h1>
        <p className="text-lg text-gray-400">{call.type === 'video' ? 'Video Call' : 'Audio Call'}</p>
      </div>

      <div className="flex w-full max-w-sm items-center justify-around">
        <div className="flex flex-col items-center gap-2">
            <Button
            size="lg"
            className="rounded-full h-20 w-20 bg-red-600 hover:bg-red-700"
            onClick={handleDecline}
            >
                <PhoneOff className="h-8 w-8" />
            </Button>
            <span className="font-semibold">Decline</span>
        </div>
         <div className="flex flex-col items-center gap-2">
            <Button
            size="lg"
            className="rounded-full h-20 w-20 bg-green-600 hover:bg-green-700"
            onClick={handleAccept}
            >
                <Phone className="h-8 w-8" />
            </Button>
             <span className="font-semibold">Accept</span>
        </div>
      </div>
    </div>
  );
}
