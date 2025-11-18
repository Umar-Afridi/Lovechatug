'use client';

import { useState, useCallback, ReactNode } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from './use-toast';
import { ProfileFrameContext, ProfileFrameContextType } from './use-profile-frame';

export function ProfileFrameProvider({ children }: { children: ReactNode }) {
  const [activeFrame, setActiveFrame] = useState<string | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const applyFrame = useCallback(
    async (frameId: string, frameUrl: string) => {
      if (!user || !firestore) {
        toast({
          title: 'Error',
          description: 'You must be logged in to use a frame.',
          variant: 'destructive',
        });
        return;
      }

      const userDocRef = doc(firestore, 'users', user.uid);

      try {
        await updateDoc(userDocRef, {
          activeFrame: frameUrl,
        });
        setActiveFrame(frameUrl);
        toast({
          title: 'Frame Applied!',
          description: 'Your new profile frame is now active.',
        });
      } catch (error) {
        console.error('Error applying frame:', error);
        toast({
          title: 'Error',
          description: 'Could not apply the frame. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [user, firestore, toast]
  );

  const value: ProfileFrameContextType = {
    activeFrame,
    setActiveFrame,
    applyFrame,
  };

  return (
    <ProfileFrameContext.Provider value={value}>
      {children}
    </ProfileFrameContext.Provider>
  );
}
