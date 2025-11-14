'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AuthHeader({ activeTab }: { activeTab: 'login' | 'signup' }) {
  return (
    <div className="flex flex-col items-center text-center mb-8">
       <div className="relative mb-4 h-28 w-48">
         <svg
          className="w-full h-full"
          viewBox="0 0 200 150"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Heart */}
          <path 
            d="M100 115C-20 70 60 10 100 50C140 10 220 70 100 115Z"
            fill="none"
            stroke="#C82A2A"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          {/* UG Text */}
          <text 
            x="100" 
            y="70" 
            fontFamily="Comic Sans MS, cursive, sans-serif" 
            fontSize="48" 
            fill="#C82A2A" 
            textAnchor="middle" 
            dy=".3em"
            fontWeight="bold"
          >
            UG
          </text>
          
           {/* LoveChat Text */}
          <g transform="translate(0, 20)">
            <text 
              x="100" 
              y="120" 
              fontFamily="Comic Sans MS, cursive, sans-serif" 
              fontSize="28" 
              fill="#6AAB35" 
              textAnchor="middle"
            >
              LoveCh
              <tspan dy="-3">
                <svg x="143" y="102" width="22" height="22" viewBox="0 0 24 24">
                   <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#6AAB35"/>
                </svg>
              </tspan>
              <tspan dx="2">t</tspan>
            </text>
          </g>
        </svg>
      </div>

      <h1 className="text-4xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate pointer-events-none -mt-4">
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
