import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './config';

// A global flag to ensure Firestore is only initialized once
let isFirestoreInitialized = false;

export function initializeFirebase() {
  const apps = getApps();
  const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  // Initialize Firestore with persistent cache
  // This enables offline capabilities and faster loading
  let firestore;
  if (!isFirestoreInitialized) {
     firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    isFirestoreInitialized = true;
  } else {
    firestore = getFirestore(app);
  }

  return { app, auth, firestore };
}
