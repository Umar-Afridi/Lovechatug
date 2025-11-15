'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase/provider';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!auth || !firestore) {
        setError("Authentication service is not available.");
        toast({ title: "Error", description: "Authentication service is not available.", variant: "destructive" });
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

    // Check if username already exists
    const usernameQuery = query(collection(firestore, 'users'), where('username', '==', username));
    const usernameSnapshot = await getDocs(usernameQuery);
    if (!usernameSnapshot.empty) {
        setError('This username is already taken. Please choose another one.');
        return;
    }
    
    try {
        // Step 1: Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Send verification email IMMEDIATELY after user creation
        await sendEmailVerification(user);

        // Step 3: Update the user's profile in Firebase Auth and create Firestore doc in parallel
        await Promise.all([
            updateProfile(user, {
                displayName: fullName,
            }),
            setDoc(doc(firestore, 'users', user.uid), {
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
                colorfulName: false,
                verificationApplicationStatus: 'none',
                isDisabled: false,
            } as Omit<UserProfile, 'officialBadge' | 'lastColorfulNameRequestAt' | 'lastVerificationRequestAt'>, { merge: true })
        ]);
        
        // Step 4: Show success message and sign the user out
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
      {message ? (
        <Alert variant="default" className="border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
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
            <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
            Create Account
            </Button>
        </form>
      )}
    </>
  );
}
