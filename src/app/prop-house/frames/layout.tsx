'use client';

import { ArrowLeft, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function FramesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-purple-50 dark:bg-purple-950/20">
      <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Gem className="h-6 w-6 text-pink-500" />
          <h1 className="text-xl font-bold">Prop Warehouse</h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col p-4 md:p-6">{children}</main>
    </div>
  );
}
