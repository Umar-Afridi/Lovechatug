'use client';

import Image from 'next/image';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useProfileFrame } from '@/hooks/use-profile-frame';
import { AnimatedLoveFrame } from './animated-love-frame';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface FrameCardProps {
  item: {
    id: string;
    name: string;
    imageUrl: string;
    quantity: number;
    durationDays: number;
  };
}

export function FrameCard({ item }: FrameCardProps) {
  const { applyFrame, removeFrame, activeFrame } = useProfileFrame();

  const isFrameActive = activeFrame === item.imageUrl;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-2 text-center shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/50">
      
      <Badge variant="secondary" className="absolute top-2 right-2 z-10">
        x{item.quantity}
      </Badge>
      
      <div className="relative w-full aspect-square flex-shrink-0">
        {item.id === 'lovechat-butterfly-frame' ? (
          <AnimatedLoveFrame />
        ) : (
          <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-contain p-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
          />
        )}
      </div>

      <div className="mt-2 flex-grow flex flex-col justify-center px-2">
         <p className="font-semibold text-sm truncate group-hover:text-primary">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.durationDays} days
        </p>
      </div>

      <div className="mt-2">
        {isFrameActive ? (
          <Button variant="destructive" className="w-full" onClick={removeFrame}>
            Remove
          </Button>
        ) : (
          <Button className="w-full" onClick={() => applyFrame(item.id, item.imageUrl)}>
            Use
          </Button>
        )}
      </div>
    </div>
  );
}
