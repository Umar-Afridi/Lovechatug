'use client';

import Image from 'next/image';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

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
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-xl z-10">
        <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-20 group-hover:animate-shine" />
      </div>

      {/* Frame Preview Area */}
      <div className="relative w-full aspect-square flex-shrink-0 animate-breathing-scale flex items-center justify-center">
        {/* Dummy Avatar */}
        <Avatar className="h-4/5 w-4/5">
            <AvatarImage src="https://picsum.photos/seed/123/200/200" alt="avatar-preview" />
            <AvatarFallback>U</AvatarFallback>
        </Avatar>

        {/* Frame Image Overlay */}
        <div className="absolute inset-0">
             <Image
                src={frame.imageUrl}
                alt={frame.name}
                fill
                className="object-contain drop-shadow-[0_5px_15px_rgba(236,72,153,0.3)]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
        </div>
      </div>

      {/* Frame Name */}
      <div className="mt-4 flex-grow flex flex-col justify-center">
        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-500">
          {frame.name}
        </h3>
      </div>

      {/* Select Button */}
      <Button className="w-full mt-4 bg-primary/90 hover:bg-primary shadow-lg z-20" size="sm">
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
