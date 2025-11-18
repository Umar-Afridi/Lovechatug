'use client';

import Image from 'next/image';
import { Button } from '../ui/button';
import { Gem } from 'lucide-react';

interface FrameCardProps {
  frame: {
    id: string;
    name: string;
    imageUrl: string;
    price: number;
    currency: string;
  };
}

export function FrameCard({ frame }: FrameCardProps) {
  return (
    <div className="group relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-card to-muted/50 p-4 flex flex-col justify-between items-center text-center shadow-lg transition-all duration-300 hover:shadow-primary/20 hover:scale-105">
      
      {/* Animated Shine Effect */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-xl">
        <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-20 group-hover:animate-shine" />
      </div>

      {/* Frame Image */}
      <div className="relative w-full aspect-square flex-shrink-0 animate-breathing-scale">
        <Image
          src={frame.imageUrl}
          alt={frame.name}
          fill
          className="object-contain drop-shadow-[0_5px_15px_rgba(236,72,153,0.3)]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Frame Name */}
      <div className="mt-4 flex-grow flex flex-col justify-center">
        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-500">
          {frame.name}
        </h3>
      </div>

      {/* Select Button */}
      <Button className="w-full mt-4 bg-primary/90 hover:bg-primary shadow-lg" size="sm">
         Select
      </Button>

      <style jsx>{`
        @keyframes shine {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
        .group-hover\:animate-shine {
          animation: shine 1.5s ease-in-out;
        }

        @keyframes breathing-scale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
        }
        .animate-breathing-scale {
            animation: breathing-scale 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
