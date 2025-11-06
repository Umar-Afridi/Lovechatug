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
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ForgotPasswordDialog } from './forgot-password-dialog';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
      
      const userDocSnap = await getDoc(userDocRef).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw new Error('Could not check user profile. Insufficient permissions.');
      });

      if (!userDocSnap.exists()) {
        const userData = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          username: user.email?.split('@')[0] ?? `user-${Date.now()}`,
          photoURL: user.photoURL,
          friends: [],
          bio: '',
        };

        await setDoc(userDocRef, userData).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'create',
              requestResourceData: userData,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw new Error('Could not save user profile. Insufficient permissions.');
          });
      }
      
      router.push('/chat');
          
    } catch (error: any) {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: error.message,
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) {
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
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/chat');
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: err.message,
      });
    }
  };

  return (
    <Card className="w-full max-w-sm shadow-2xl shadow-primary/10">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-headline">Welcome to LoveChat</CardTitle>
        <CardDescription>
          Sign in to connect with your loved ones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
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
           <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} type="button">
            <GoogleIcon className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
