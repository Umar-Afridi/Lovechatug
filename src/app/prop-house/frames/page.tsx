'use client';

import { AnimatedLoveFrame } from '@/components/prop-house/animated-love-frame';

export default function FramesPage() {
  return (
    <div className="w-full max-w-4xl mx-auto flex items-center justify-center">
       <div className="relative w-[350px] h-[350px] md:w-[450px] md:h-[450px]">
         <AnimatedLoveFrame />
       </div>
    </div>
  );
}
