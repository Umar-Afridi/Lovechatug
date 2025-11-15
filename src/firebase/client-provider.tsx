'use client';
import { initializeFirebase } from '.';
import { FirebaseProvider } from './provider';
import React from 'react';

// This provider is used to initialize Firebase on the client side.
// It should be used as a wrapper around the root of the application.
// It ensures that Firebase is initialized only once.
export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Memoize the initialization to prevent re-running on every render.
  const firebaseInstances = React.useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider {...firebaseInstances}>
      {children}
    </FirebaseProvider>
  );
}
