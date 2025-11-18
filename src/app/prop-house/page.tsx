'use client';

import Link from 'next/link';
import { Frame, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


export default function PropHousePage() {
  const baseButtonClassName = "w-full text-base py-8 justify-center rounded-lg border-b-4 active:translate-y-1 active:border-b-0 transition-all duration-150 ease-in-out";

  return (
    <div className="p-4 md:p-8 flex-1 flex flex-col">
      <div className="w-full max-w-md space-y-6 mx-auto">
        <Button asChild variant="outline" className={cn(baseButtonClassName, "border-blue-600 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20")}>
          <Link href="/prop-house/frames">
            <Frame className="mr-4 h-6 w-6 text-blue-500" />
            Frames
          </Link>
        </Button>
        <Button asChild variant="outline" className={cn(baseButtonClassName, "border-green-600 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20")}>
          <Link href="#">
            <FileText className="mr-4 h-6 w-6 text-green-500" />
            Entries
          </Link>
        </Button>
        <Button asChild variant="outline" className={cn(baseButtonClassName, "border-pink-600 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-900/20")}>
          <Link href="#">
            <MessageCircle className="mr-4 h-6 w-6 text-pink-500" />
            Bubbles
          </Link>
        </Button>
      </div>
    </div>
  );
}
