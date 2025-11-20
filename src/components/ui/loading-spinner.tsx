'use client';

import { cn } from '@/lib/utils';
import React from 'react';

export function LoadingSpinner() {
  const letters = [
    { char: 'L', color: 'text-pink-500' },
    { char: 'O', color: 'text-purple-500' },
    { char: 'V', color: 'text-green-500' },
    { char: 'E', color: 'text-yellow-500' },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 animate-[spin-colors_2s_linear_infinite] rounded-full border-4 border-t-pink-500 border-r-purple-500 border-b-green-500 border-l-yellow-500"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          {letters.map((letter, index) => (
            <span
              key={index}
              className={cn(
                'text-2xl font-bold',
                letter.color
              )}
              style={{ animation: `bounce-letter 1s ease-in-out ${index * 0.1}s infinite` }}
            >
              {letter.char}
            </span>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}
