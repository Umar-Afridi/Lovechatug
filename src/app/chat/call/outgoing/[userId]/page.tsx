
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, onSnapshot, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';
import type { UserProfile, Call } from '@/lib/types';
import { useSound } from '@/hooks/use-sound';

export default function OutgoingCallPage() {
  const params = useParams();
  const otherUserId = params.userId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const callId = searchParams.get('callId');

  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callData, setCallData] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState('Calling...');
  const [loading, setLoading] = useState(true);

  const { play, stop } = useSound('https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/Ringing.mp3?alt=media&token=24075f11-715d-4a57-9bf4-1594adaa995e', { loop: true });


  // Fetch receiver's profile
  useEffect(() => {
    if (!firestore || !otherUserId) return;
    const userDocRef = doc(firestore, 'users', otherUserId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserProfile;
        setOtherUser(userData);
        if (userData.isOnline) {
            setCallStatus('Ringing...');
            play();
        } else {
            setCallStatus('Calling...');
        }
      } else {
        router.push('/chat'); // User not found
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firestore, otherUserId, router, play]);

  // Listen to call document for status changes
  useEffect(() => {
    if (!firestore || !callId) return;
    const callDocRef = doc(firestore, 'calls', callId);
    const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Call;
        setCallData(data);
        if (data.status === 'declined' || data.status === 'missed') {
            stop();
            const chatId = [data.callerId, data.receiverId].sort().join('_');
            const messagesRef = collection(firestore, `chats/${chatId}/messages`);
            addDoc(messagesRef, {
                senderId: data.callerId,
                type: 'call',
                content: 'Call not answered',
                timestamp: serverTimestamp(),
                status: 'sent',
                callInfo: {
                    type: data.type,
                    duration: '0s',
                    status: 'missed'
                }
            }).finally(() => {
                 setTimeout(() => {
                    deleteDoc(callDocRef).finally(() => router.back());
                 }, 2000);
            });
        } else if (data.status === 'answered') {
          stop();
          router.replace(`/chat/call/active/${callId}`);
        }
      } else {
        // Call document deleted (e.g., cancelled by caller)
        stop();
        router.back();
      }
    });

    return () => {
        stop();
        unsubscribe();
    };
  }, [firestore, callId, router, stop]);


  const handleHangUp = async () => {
    stop();
    if (!firestore || !callId || !authUser) {
      router.back();
      return;
    }
    const callDocRef = doc(firestore, 'calls', callId);
    try {
      await deleteDoc(callDocRef);
    } catch (error) {
      console.error("Error hanging up call:", error);
    } finally {
      router.back();
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  if (loading || !otherUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        <p>Preparing call...</p>
      </div>
    );
  }

  const getStatusText = () => {
    if (callData?.status === 'declined') return 'Call Declined';
    if (callData?.status === 'missed' && !otherUser.isOnline) return 'Unavailable';
    if (callData?.status === 'missed') return 'Call Unanswered';
    return callStatus;
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-between bg-gray-900 text-white p-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <Avatar className="h-32 w-32 border-4 border-gray-600">
          <AvatarImage src={otherUser.photoURL} />
          <AvatarFallback className="text-5xl bg-gray-700">
            {getInitials(otherUser.displayName)}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-4xl font-bold">{otherUser.displayName}</h1>
        <p className="text-lg text-gray-400">{getStatusText()}</p>
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
