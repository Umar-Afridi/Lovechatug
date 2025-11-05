import { LoginForm } from '@/components/auth/login-form';
import { Leaf } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-2 mb-8">
            <h1 className="text-4xl font-headline font-bold text-primary">
              Roshan Chat
            </h1>
        </div>
        <LoginForm />
      </div>
       <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
          <p>Powered by Firebase and Google AI</p>
        </footer>
    </main>
  );
}
