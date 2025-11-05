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
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !firestore) return;

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get('fullName') as string;
    const username = (formData.get('username') as string).toLowerCase();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!username) {
        setError("Username is required.");
        return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: fullName,
      });
      
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      const userData = {
        uid: userCredential.user.uid,
        displayName: fullName,
        email: email,
        username: username,
        photoURL: userCredential.user.photoURL,
        friends: [],
        bio: '',
      };

      setDoc(userDocRef, userData)
        .then(() => {
          router.push('/chat');
        })
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'create',
            requestResourceData: userData,
          });
          errorEmitter.emit('permission-error', permissionError);
          setError('Could not save user profile. Insufficient permissions.');
        });

    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Card className="w-full max-w-sm shadow-2xl shadow-primary/10">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-headline">Join LoveChat</CardTitle>
        <CardDescription>
          Create your account to start chatting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" placeholder="John Doe" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
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
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/" className="underline">
              Login
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
