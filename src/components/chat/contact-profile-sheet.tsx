'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { UserProfile, FriendRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '../ui/verified-badge';
import { OfficialBadge } from '../ui/official-badge';
import { Button } from '../ui/button';
import { UserPlus, Check, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContactProfileSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userProfile: UserProfile | null;
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
};

function applyNameColor(name: string, color?: UserProfile['nameColor']) {
    if (!color || color === 'default') {
        return name;
    }
    if (color === 'gradient') {
        return <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate">{name}</span>;
    }
    
    const colorClasses: Record<Exclude<NonNullable<UserProfile['nameColor']>, 'default' | 'gradient'>, string> = {
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };

    return <span className={cn('font-bold', colorClasses[color])}>{name}</span>;
}


export function ContactProfileSheet({
  isOpen,
  onOpenChange,
  userProfile,
}: ContactProfileSheetProps) {
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<'friends' | 'request_sent' | 'not_friends' | 'self'>('not_friends');
  const [sentRequest, setSentRequest] = useState<(FriendRequest & {id: string}) | null>(null);

  // Fetch current user's profile for friend list
  useEffect(() => {
    if (!firestore || !authUser) return;
    const unsub = onSnapshot(doc(firestore, 'users', authUser.uid), (doc) => {
      setCurrentUserProfile(doc.data() as UserProfile);
    });
    return () => unsub();
  }, [firestore, authUser]);

  // Determine friendship status
  useEffect(() => {
    if (!currentUserProfile || !userProfile || !authUser || !firestore) return;

    if (currentUserProfile.uid === userProfile.uid) {
        setFriendshipStatus('self');
        return;
    }
    if (currentUserProfile.friends?.includes(userProfile.uid)) {
        setFriendshipStatus('friends');
        return;
    }

    // Check if a request has been sent
    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(
        requestsRef, 
        where('senderId', '==', authUser.uid),
        where('receiverId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
            setFriendshipStatus('request_sent');
            setSentRequest({id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data()} as (FriendRequest & {id: string}));
        } else {
            setFriendshipStatus('not_friends');
            setSentRequest(null);
        }
    });

    return () => unsubscribe();
  }, [currentUserProfile, userProfile, authUser, firestore]);

  const handleSendRequest = async () => {
      if (!firestore || !authUser || !userProfile) return;
      
      const newRequest = {
          senderId: authUser.uid,
          receiverId: userProfile.uid,
          status: 'pending' as const,
          createdAt: serverTimestamp(),
      };
      
      try {
          await addDoc(collection(firestore, 'friendRequests'), newRequest);
          setFriendshipStatus('request_sent');
          toast({ title: 'Request Sent', description: `Your friend request to ${userProfile.displayName} has been sent.`});
      } catch (error) {
          console.error("Error sending friend request:", error);
          toast({ title: 'Error', description: 'Could not send friend request.', variant: 'destructive'});
      }
  };
  
   const handleCancelRequest = async () => {
      if (!firestore || !sentRequest?.id) return;
      try {
          await deleteDoc(doc(firestore, 'friendRequests', sentRequest.id));
          setFriendshipStatus('not_friends');
          setSentRequest(null);
          toast({ title: 'Request Cancelled' });
      } catch (error) {
          console.error("Error cancelling friend request:", error);
          toast({ title: 'Error', description: 'Could not cancel friend request.', variant: 'destructive' });
      }
  };


  if (!userProfile) {
    return null;
  }
  
  const renderFriendButton = () => {
      switch(friendshipStatus) {
          case 'self':
              return null;
          case 'friends':
              return <Button variant="secondary" className="w-full" disabled><Check className="mr-2 h-4 w-4"/> Friends</Button>;
          case 'request_sent':
              return <Button variant="outline" className="w-full" onClick={handleCancelRequest}><Clock className="mr-2 h-4 w-4"/> Request Sent</Button>;
          case 'not_friends':
              return <Button className="w-full" onClick={handleSendRequest}><UserPlus className="mr-2 h-4 w-4" /> Add Friend</Button>;
          default:
              return null;
      }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="text-center">
          <div className="flex justify-center mb-4 relative">
            <Avatar className="h-24 w-24 border-2 border-primary">
              <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
              <AvatarFallback className="text-3xl">
                {getInitials(userProfile.displayName)}
              </AvatarFallback>
            </Avatar>
          </div>
          
           {userProfile.officialBadge?.isOfficial && (
                <div className="flex justify-center mb-2">
                    <OfficialBadge color={userProfile.officialBadge.badgeColor} isOwner={userProfile.canManageOfficials} />
                </div>
            )}
          <SheetTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            {applyNameColor(userProfile.displayName, userProfile.nameColor)}
            {userProfile.verifiedBadge?.showBadge && (
                <VerifiedBadge color={userProfile.verifiedBadge.badgeColor} className="h-6 w-6"/>
            )}
            </SheetTitle>
          <SheetDescription className="text-muted-foreground">@{userProfile.username}</SheetDescription>
        </SheetHeader>
        
        <Separator className="my-4"/>

        <div className="flex-1 space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Bio</h3>
            <p className="text-base text-foreground">
                {userProfile.bio || 'This user has not set a bio yet.'}
            </p>
        </div>

        <div className="mt-auto py-4">
            {renderFriendButton()}
        </div>
        
      </SheetContent>
    </Sheet>
  );
}
