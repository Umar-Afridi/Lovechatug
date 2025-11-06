'use client';

import { SignupForm } from '@/components/auth/signup-form';
import { Heart } from 'lucide-react';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-2 mb-8">
            <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-2">
              <span>Love</span>
              <Heart className="h-8 w-8 text-red-500 fill-current" />
              <span>Chat</span>
            </h1>
        </div>
        <SignupForm />
      </div>
       <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
          <p>Powered by Firebase and Google AI</p>
        </footer>
    </main>
  );
}
