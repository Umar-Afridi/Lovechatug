'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { GoogleIcon } from '@/components/icons/google-icon';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase/provider';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ForgotPasswordDialog } from './forgot-password-dialog';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function LoginForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Firebase authentication service is not available.",
      });
      return;
    }
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userDocRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
            const newUserProfile: UserProfile = {
                uid: user.uid,
                displayName: user.displayName || 'Anonymous User',
                email: user.email || '',
                username: user.email?.split('@')[0] || `user-${Date.now()}`,
                photoURL: user.photoURL || '',
                friends: [],
                bio: '',
                isOnline: true,
                lastSeen: serverTimestamp(),
                blockedUsers: [],
                blockedBy: [],
            };
            await setDoc(userDocRef, newUserProfile).catch((serverError) => {
              const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'create',
                requestResourceData: newUserProfile,
              });
              errorEmitter.emit('permission-error', permissionError);
              // Don't re-throw, let the user proceed. The error will show in dev overlay.
            });
        }
        router.push('/chat');

    } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          return; // Do nothing if user closes the popup
        }
        let friendlyMessage = "An unknown error occurred during sign-in.";
        if (error.code === 'auth/account-exists-with-different-credential') {
            friendlyMessage = "An account already exists with the same email address but different sign-in credentials.";
        }
        setError(error.message);
        toast({
            variant: "destructive",
            title: "Google Sign-In Failed",
            description: friendlyMessage,
        });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!auth || !firestore) {
       setError('Firebase Auth not available.');
       toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Firebase authentication service is not available.",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user document exists
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as UserProfile;
          // Check if the user is disabled
          if (userData.isDisabled) {
              await auth.signOut(); // Sign the user out
              setError("Your account has been disabled.");
              toast({
                  variant: "destructive",
                  title: "Account Disabled",
                  description: "Your account has been disabled by an administrator.",
              });
              return;
          }
      }

      if (!userCredential.user.emailVerified) {
        setError("Please verify your email before logging in.");
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: "Please check your inbox and verify your email address.",
        });
        // Optionally, re-send verification email
        await sendEmailVerification(userCredential.user);
        return; // Stop the login process
      }
      router.push('/chat');
    } catch (err: any) {
      setError(err.message);
      let friendlyMessage = "An unknown error occurred.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyMessage = "Invalid email or password. Please try again.";
      }
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: friendlyMessage,
      });
    }
  };

  return (
    <>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Welcome Back</h2>
        <p className="text-muted-foreground text-sm">Enter your credentials to access your account.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="love@example.com" required />
        </div>
        <div className="space-y-2">
           <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <ForgotPasswordDialog />
           </div>
          <Input id="password" name="password" type="password" required />
        </div>
         {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">
          Login
        </Button>
        <Separator className="my-4" />
         <Button className="w-full bg-red-600 text-white hover:bg-red-700" onClick={handleGoogleSignIn} type="button">
          <GoogleIcon className="mr-2 h-5 w-5" />
          Sign in with Google
        </Button>
      </form>
    </>
  );
}
