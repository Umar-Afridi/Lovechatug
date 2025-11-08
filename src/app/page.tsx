'use client';

import { LoginForm } from '@/components/auth/login-form';
import { AuthHeader } from '@/components/auth/auth-header';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <AuthHeader activeTab="login" />
        <Card className="rounded-t-none">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
       <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
          <p>Powered by Umar Afridi Developer</p>
        </footer>
    </main>
  );
}
