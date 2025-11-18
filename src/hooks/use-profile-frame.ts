'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from './use-toast';

export interface ProfileFrameContextType {
  activeFrame: string | null;
  setActiveFrame: (frameUrl: string | null) => void;
  applyFrame: (frameId: string, frameUrl: string) => void;
}

export const ProfileFrameContext = createContext<ProfileFrameContextType | null>(null);

export function useProfileFrame() {
  const context = useContext(ProfileFrameContext);
  if (!context) {
    throw new Error('useProfileFrame must be used within a ProfileFrameProvider');
  }
  return context;
}
