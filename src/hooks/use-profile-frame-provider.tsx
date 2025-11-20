'use client';

import { useState, useCallback, ReactNode, useEffect } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useToast } from './use-toast';
import { ProfileFrameContext, ProfileFrameContextType } from './use-profile-frame';
import type { UserProfile } from '@/lib/types';

export function ProfileFrameProvider({ children }: { children: ReactNode }) {
  const [activeFrame, setActiveFrame] = useState<string | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !firestore) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if(doc.exists()) {
            const userData = doc.data() as UserProfile;
            setActiveFrame(userData.activeFrame || null);
        }
    });
    return () => unsubscribe();
  }, [user, firestore]);

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
        // No need to setActiveFrame here, the onSnapshot listener will do it.
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
  
  const removeFrame = useCallback(async () => {
    if (!user || !firestore) {
        toast({
          title: 'Error',
          description: 'You must be logged in to remove a frame.',
          variant: 'destructive',
        });
        return;
      }

      const userDocRef = doc(firestore, 'users', user.uid);
      
      try {
        await updateDoc(userDocRef, {
            activeFrame: null,
        });
        // No need to setActiveFrame here, the onSnapshot listener will do it.
        toast({
          title: 'Frame Removed',
          description: 'Your profile frame has been removed.',
        });
      } catch (error) {
         console.error('Error removing frame:', error);
        toast({
          title: 'Error',
          description: 'Could not remove the frame. Please try again.',
          variant: 'destructive',
        });
      }

  }, [user, firestore, toast]);

  const value: ProfileFrameContextType = {
    activeFrame,
    setActiveFrame,
    applyFrame,
    removeFrame,
  };

  return (
    <ProfileFrameContext.Provider value={value}>
      {children}
    </ProfileFrameContext.Provider>
  );
}
