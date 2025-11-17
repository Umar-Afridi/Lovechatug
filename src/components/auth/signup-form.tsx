'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase/provider';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
    
    try {
        // Check if username already exists
        const usersRef = collection(firestore, 'users');
        const usernameQuery = query(usersRef, where('username', '==', username));
        
        try {
            const usernameSnapshot = await getDocs(usernameQuery);
            if (!usernameSnapshot.empty) {
                setError('This username is already taken. Please choose another one.');
                return;
            }
        } catch(serverError: any) {
             if (serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({ path: 'users', operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            }
            // We re-throw to stop execution if username check fails
            throw serverError;
        }

        // Step 1: Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Send verification email IMMEDIATELY after user creation
        await sendEmailVerification(user);

        // Step 3: Create Firestore doc with all default fields
        const newUserProfileData: UserProfile = {
            uid: user.uid,
            displayName: fullName,
            email: email,
            username: username,
            photoURL: user.photoURL ?? '',
            friends: [],
            chatIds: [],
            bio: '',
            isOnline: false,
            lastSeen: serverTimestamp(),
            blockedUsers: [],
            blockedBy: [],
            chatsCleared: {},
            verifiedBadge: {
                showBadge: false,
                badgeColor: 'blue'
            },
            officialBadge: {
                isOfficial: false,
                badgeColor: 'gold'
            },
            canManageOfficials: false,
            nameColor: 'default',
            verificationApplicationStatus: 'none',
            isDisabled: false,
            activityScore: 0,
        };
        
        const userDocRef = doc(firestore, 'users', user.uid);
        
        // This is wrapped in a promise to handle the permission error correctly
        await Promise.all([
            updateProfile(user, { displayName: fullName }),
            setDoc(userDocRef, newUserProfileData, { merge: true })
                .catch((serverError: any) => {
                    if (serverError.code === 'permission-denied') {
                        const permissionError = new FirestorePermissionError({
                            path: userDocRef.path,
                            operation: 'create',
                            requestResourceData: newUserProfileData
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    }
                    // Re-throw to make sure the outer catch block handles it
                    throw serverError;
                })
        ]);
        
        // Step 4: Show success message and sign the user out
        setMessage("A verification email has been sent. Please check your inbox and verify your email before logging in.");
        (event.target as HTMLFormElement).reset();
        await auth.signOut();

      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
           setError('This email address is already in use by another account.');
        } else if (err.code !== 'permission-denied') {
           // We only set a generic error if it's not a permission error,
           // because permission errors are now handled globally.
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
