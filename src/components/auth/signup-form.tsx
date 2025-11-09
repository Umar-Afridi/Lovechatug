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
        const q = query(usersRef, where('username', '==', username));
        const usernameQuerySnapshot = await getDocs(q);
        if (!usernameQuerySnapshot.empty) {
            setError('This username is already taken. Please try another one.');
            return;
        }

        // Create the user but don't sign them in yet.
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update profile and create Firestore document
        await updateProfile(user, {
          displayName: fullName,
        });
        
        const userDocRef = doc(firestore, 'users', user.uid);
        const userData: UserProfile = {
          uid: user.uid,
          displayName: fullName,
          email: email,
          username: username,
          photoURL: user.photoURL ?? '',
        };
        await setDoc(userDocRef, userData);
        
        // Send verification email
        await sendEmailVerification(user);

        // Show success message
        setMessage("A verification email has been sent. Please check your inbox and verify your email before logging in.");
        (event.target as HTMLFormElement).reset();
        
        // Sign the user out so they have to verify before logging in
        await auth.signOut();

      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
           setError('This email address is already in use by another account.');
        } else if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: usersRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setError('A permission error occurred while checking the username. Please check the developer console for more details.');
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
