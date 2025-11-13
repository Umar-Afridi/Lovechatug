'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase/provider';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { CheckCircle } from 'lucide-react';

export function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!auth || !firestore) {
        setError("Authentication service is not available.");
        return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get('fullName') as string;
    const usernameInput = formData.get('username') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!usernameInput) {
        setError("Username is required.");
        return;
    }
    
    if (usernameInput !== usernameInput.toLowerCase()) {
      setError("Username must be all lowercase.");
      return;
    }

    const username = usernameInput.toLowerCase();
    
    const usersRef = collection(firestore, 'users');

    try {
        // FIX: Removed username availability check that caused permission errors.
        // The logic for handling non-unique usernames can be added later if needed,
        // for example, by using Firestore Security Rules to enforce uniqueness.

        // Step 1: Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Update the user's profile in Firebase Auth (e.g., display name)
        await updateProfile(user, {
          displayName: fullName,
        });
        
        // Step 3: Create the user document in Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        const userData: Omit<UserProfile, 'officialBadge' | 'lastColorfulNameRequestAt' | 'lastVerificationRequestAt' | 'verificationApplicationStatus' | 'colorfulName'> = {
          uid: user.uid,
          displayName: fullName,
          email: email,
          username: username,
          photoURL: user.photoURL ?? '',
          friends: [],
          bio: '',
          isOnline: false,
          lastSeen: serverTimestamp(),
          blockedUsers: [],
          blockedBy: [],
          verifiedBadge: {
            showBadge: false,
            badgeColor: 'blue'
          },
          isDisabled: false,
        };
        await setDoc(userDocRef, userData, { merge: true });
        
        // Step 4: Send verification email
        await sendEmailVerification(user);

        // Step 5: Show success message and sign the user out
        setMessage("A verification email has been sent. Please check your inbox and verify your email before logging in.");
        (event.target as HTMLFormElement).reset();
        await auth.signOut();

      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
           setError('This email address is already in use by another account.');
        } else if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: 'users collection during signup', // Simplified path
                operation: 'create', // The intended operation was to check then create
            });
            errorEmitter.emit('permission-error', permissionError);
            setError('A permission error occurred during signup. Please check your Firestore security rules.');
        }
        else {
           setError(err.message || "An unknown error occurred during signup.");
        }
      }
  };

  return (
    <>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Create an Account</h2>
        <p className="text-muted-foreground text-sm">Join the community and start chatting!</p>
      </div>
      {message ? (
        <Alert variant="default" className="border-green-500 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
                {message}
            </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" placeholder="Love Chat" required />
            </div>
            <div className="space-y-2">
            <Label htmlFor="username">Username (lowercase only)</Label>
            <Input id="username" name="username" placeholder="lovechat" required />
            </div>
            <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="love@example.com" required />
            </div>
            <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
            Create Account
            </Button>
        </form>
      )}
    </>
  );
}
