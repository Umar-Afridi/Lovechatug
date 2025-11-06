'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AuthHeader({ activeTab }: { activeTab: 'login' | 'signup' }) {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="relative mb-4">
        <svg
          className="w-24 h-24 text-primary"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
          UG
        </span>
      </div>

      <h1 className="text-4xl font-headline font-bold text-primary">
        Love Chat
      </h1>
      
      <div className="mt-8 w-full max-w-xs">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <Button asChild variant={activeTab === 'login' ? 'default' : 'ghost'} className={cn(activeTab === 'login' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>
            <Link href="/">Login</Link>
          </Button>
          <Button asChild variant={activeTab === 'signup' ? 'default' : 'ghost'} className={cn(activeTab === 'signup' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
