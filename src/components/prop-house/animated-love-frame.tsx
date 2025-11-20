'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

type AnimatedStyle = {
  id: number;
  style: React.CSSProperties;
};

export function AnimatedLoveFrame() {
  const [butterflies, setButterflies] = useState<AnimatedStyle[]>([]);
  const [particles, setParticles] = useState<AnimatedStyle[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render
    setIsClient(true);
    
    setButterflies(Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      style: {
        left: `${Math.random() * 60 + 20}%`,
        animation: `fly-up ${Math.random() * 5 + 5}s ${Math.random() * 5}s linear infinite`,
        transform: `scale(${Math.random() * 0.3 + 0.6})`,
      },
    })));

    setParticles(Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animation: `float-particles ${Math.random() * 4 + 3}s ${Math.random() * 4}s ease-in-out infinite`,
          backgroundColor: Math.random() > 0.5 ? 'hsl(var(--theme-pink))' : 'hsl(var(--theme-yellow))',
          width: `${Math.random() * 2 + 1}px`,
          height: `${Math.random() * 2 + 1}px`,
      }
    })));

  }, []);

  const frameImageUrl = 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Flovechat_frame.png?alt=media&token=e9391338-3375-4752-953e-86d3b45155e8';

  return (
    <div className="relative w-full h-full flex items-center justify-center">

        {/* Floating Particles */}
        <div className="absolute inset-0 w-full h-full overflow-visible">
            {isClient && particles.map(p => (
                <div key={p.id} className="absolute rounded-full opacity-0" style={p.style} />
            ))}
        </div>

      {/* Blurred Profile Picture Background */}
      <div className="absolute w-[65%] h-[65%] rounded-full overflow-hidden">
        <Image
          src="https://picsum.photos/seed/profile/400/400"
          alt="Profile"
          fill
          className="object-cover blur-sm scale-110"
        />
      </div>

      {/* The main frame image */}
      <div className="absolute inset-0 w-full h-full">
         <div className="relative w-full h-full animate-[pulse-glow_4s_ease-in-out_infinite]">
            <Image
                src={frameImageUrl}
                alt="Love Chat Frame"
                fill
                className="object-contain drop-shadow-[0_5px_15px_rgba(236,72,153,0.3)]"
            />
         </div>
      </div>
      
       {/* Shimmer Effect */}
       <div 
        className="absolute w-full h-full rounded-full overflow-hidden opacity-30 mix-blend-overlay"
        style={{
            maskImage: `url(${frameImageUrl})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
        }}
       >
        <div 
            className="w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
            style={{ animation: 'shimmer 4s linear infinite' }}
        />
      </div>


      {/* Flying Butterflies */}
      <div className="absolute w-[55%] h-[55%] overflow-hidden">
        {isClient && butterflies.map((butterfly) => (
          <div
            key={butterfly.id}
            className="absolute bottom-0 text-pink-300 drop-shadow-[0_0_5px_#EC4899] opacity-0"
            style={butterfly.style}
          >
            🦋
          </div>
        ))}
      </div>
    </div>
  );
}
