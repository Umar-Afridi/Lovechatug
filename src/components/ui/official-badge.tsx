'use client';

import { cn } from '@/lib/utils';
import { VariantProps, cva } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
  {
    variants: {
      color: {
        blue: 'bg-blue-500 text-white',
        gold: 'bg-yellow-500 text-white',
        green: 'bg-green-500 text-white',
        red: 'bg-red-500 text-white',
        pink: 'bg-pink-500 text-white',
      },
      size: {
        default: 'px-3 py-1 text-sm',
        icon: 'h-6 w-6 p-0 justify-center',
      },
    },
    defaultVariants: {
      color: 'gold',
      size: 'default',
    },
  }
);

interface OfficialBadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
}

export function OfficialBadge({ color, size, className }: OfficialBadgeProps) {

  return (
    <div className={cn(badgeVariants({ color, size }), className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-bold',
           size === 'icon' ? 'h-full w-full' : 'h-5 w-5'
        )}
      >
        <span className={cn(size === 'icon' ? 'text-xs' : 'text-sm' )}>V</span>
      </div>
      {size !== 'icon' && <span>Official</span>}
    </div>
  );
}
