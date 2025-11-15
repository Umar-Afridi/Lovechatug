import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// A global flag to ensure Firestore is only initialized once
let isFirestoreInitialized = false;

interface FirebaseInstances {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

// A global variable to hold the initialized Firebase instances
let firebaseInstances: FirebaseInstances | null = null;


export function initializeFirebase(): FirebaseInstances {
  if (typeof window === 'undefined') {
    // On the server, we can't initialize a client-side app, but we can't return null
    // because it would break hooks. We return a "dummy" object.
    // The actual initialization will happen on the client.
    if (firebaseInstances) return firebaseInstances;
    
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    firebaseInstances = { app, auth, firestore };
    return firebaseInstances;
  }

  // On the client, if we've already initialized, return the existing instances.
  if (firebaseInstances) {
    return firebaseInstances;
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  
  // Initialize Firestore with persistent cache
  // This enables offline capabilities and faster loading
  let firestore: Firestore;
  if (!isFirestoreInitialized) {
     try {
        firestore = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
        isFirestoreInitialized = true;
     } catch (e) {
        console.error("Firestore persistence initialization error:", e);
        // If persistence fails (e.g., in some browser environments),
        // fallback to default in-memory Firestore.
        firestore = getFirestore(app);
     }
  } else {
    firestore = getFirestore(app);
  }

  firebaseInstances = { app, auth, firestore };
  return firebaseInstances;
}
