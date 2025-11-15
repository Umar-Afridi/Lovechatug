'use client';
import { initializeFirebase } from '.';
import { FirebaseProvider } from './provider';

// This provider is used to initialize Firebase on the client side.
// It should be used as a wrapper around the root of the application.
// It ensures that Firebase is initialized only once.
export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { app, auth, firestore } = initializeFirebase();

  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
