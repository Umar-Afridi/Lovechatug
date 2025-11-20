'use client';

import React from 'react';
import { Tv } from 'lucide-react';

export default function RoomsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background p-8 text-center">
        <Tv className="h-24 w-24 text-muted-foreground/50 mb-6" />
        <h1 className="text-2xl font-bold">This Feature is Coming Soon</h1>
        <p className="mt-2 text-muted-foreground">
            We are working hard to bring you an amazing voice chat experience.
        </p>
    </div>
  );
}
