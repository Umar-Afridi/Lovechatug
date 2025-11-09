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
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
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
    setError(null); // Reset error on new submission
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
    
    // Enforce lowercase username
    if (usernameInput !== usernameInput.toLowerCase()) {
      setError("Username must be all lowercase.");
      return;
    }

    const username = usernameInput.toLowerCase();

    try {
        // --- Start: New Validation Logic ---
        
        // 1. Check if email is in the deletedUsers collection
        const deletedUserRef = doc(firestore, 'deletedUsers', email);
        const deletedUserSnap = await getDoc(deletedUserRef);
        if (deletedUserSnap.exists()) {
            setError("This email is associated with a deleted account. Please use a different email.");
            return;
        }

        // 2. Check if username is already taken
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', username));
        const usernameQuerySnapshot = await getDocs(q);
        if (!usernameQuerySnapshot.empty) {
            setError('This username is already taken. Please try another one.');
            return;
        }

        // --- End: New Validation Logic ---

        // 3. If all checks pass, create the user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // 4. Send verification email
        if (auth.currentUser) {
            try {
                await sendEmailVerification(auth.currentUser);
            } catch (verificationError) {
                console.error("Failed to send verification email:", verificationError);
                // The account is created, so proceed with db write but show an error.
                setError("Account created, but failed to send verification email. Please try logging in to trigger a new email.");
            }
        } else {
             // This case is unlikely but handled for safety
            console.error("No current user found after account creation.");
            setError("Account created, but could not find user to send verification email.");
        }
        
        // 5. Update profile and create Firestore document
        await updateProfile(userCredential.user, {
          displayName: fullName,
        });
        
        const userDocRef = doc(firestore, 'users', userCredential.user.uid);
        const userData: UserProfile = {
          uid: userCredential.user.uid,
          displayName: fullName,
          email: email,
          username: username,
          photoURL: userCredential.user.photoURL ?? '',
          friends: [],
          bio: '',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          blockedUsers: [],
        };

        await setDoc(userDocRef, userData);
        
        // 6. Show success message instead of redirecting
        setMessage("A verification email has been sent. Please check your inbox and verify your email before logging in.");
        // Clear the form fields if needed
        (event.target as HTMLFormElement).reset();


      } catch (err: any) {
        // Handle Firebase auth errors (e.g., email-already-in-use)
        if (err.code === 'auth/email-already-in-use') {
           setError('This email address is already in use by another account.');
        } else if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: 'users or deletedUsers', // This is a simplification for the user
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setError('Could not complete signup. Insufficient permissions.');
        }
        else {
           setError(err.message);
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
            <Input id="fullName" name="fullName" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
            <Label htmlFor="username">Username (lowercase only)</Label>
            <Input id="username" name="username" placeholder="johndoe" required />
            </div>
            <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
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
