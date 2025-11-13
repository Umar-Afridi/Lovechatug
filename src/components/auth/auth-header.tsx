'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AuthHeader({ activeTab }: { activeTab: 'login' | 'signup' }) {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="relative mb-4 h-24 w-24">
         <svg
          className="w-full h-full text-red-500"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M50 95 C 10 60, 40 30, 50 50 C 60 30, 90 60, 50 95 Z" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="8" 
            strokeLinejoin="round" 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pb-2">
            <span className="text-red-500 font-bold text-3xl" style={{ fontFamily: "'Comic Sans MS', cursive, sans-serif" }}>
                UG
            </span>
        </div>
      </div>

      <h1 className="text-4xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate pointer-events-none">
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
