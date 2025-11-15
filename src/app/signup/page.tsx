'use client';

import { SignupForm } from '@/components/auth/signup-form';
import { AuthHeader } from '@/components/auth/auth-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <AuthHeader activeTab="signup" />
        <Card className="rounded-t-none">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
            <CardDescription>Join the community and start chatting!</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by Umar Afridi Developer</p>
        </footer>
      </div>
    </main>
  );
}
