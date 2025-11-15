import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './config';

// A global flag to ensure Firestore is only initialized once
let isFirestoreInitialized = false;

export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  
  // Initialize Firestore with persistent cache
  // This enables offline capabilities and faster loading
  let firestore;
  if (typeof window !== 'undefined' && !isFirestoreInitialized) {
     try {
        firestore = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
        isFirestoreInitialized = true;
     } catch (e) {
        console.error("Firestore initialization error:", e);
        firestore = getFirestore(app); // Fallback to default initialization
     }
  } else {
    firestore = getFirestore(app);
  }

  return { app, auth, firestore };
}
