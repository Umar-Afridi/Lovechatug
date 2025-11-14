'use client';

import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function RoomsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-muted/20">
      <h2 className="text-2xl font-bold mb-2">Voice Rooms</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Create a room to talk with friends, host events, or just hang out.
      </p>
      <Button size="lg" className="py-6 px-8 text-lg" asChild>
        <Link href="/chat/rooms/create">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create Your Room
        </Link>
      </Button>
    </div>
  );
}
