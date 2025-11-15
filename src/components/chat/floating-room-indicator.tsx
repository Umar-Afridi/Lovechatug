'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic } from 'lucide-react';
import type { Room } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FloatingRoomIndicatorProps {
  room: Room;
}

export function FloatingRoomIndicator({ room }: FloatingRoomIndicatorProps) {
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'R';

  return (
    <Link href={`/chat/rooms/${room.id}`} passHref>
      <motion.div
        drag
        dragConstraints={{ top: -200, left: -300, right: 20, bottom: 20 }}
        dragElastic={0.2}
        dragMomentum={false}
        className="fixed bottom-24 right-4 z-50 cursor-pointer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="relative">
           <motion.div
            className="absolute -inset-1 rounded-full bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 opacity-75 blur"
            animate={{ 
                rotate: 360,
            }}
            transition={{ 
                duration: 4, 
                ease: "linear", 
                repeat: Infinity 
            }}
          />
          <Avatar className="h-16 w-16 border-2 border-background relative">
            <AvatarImage src={room.photoURL} />
            <AvatarFallback className="text-xl bg-muted">{getInitials(room.name)}</AvatarFallback>
             <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Mic className="h-6 w-6 text-white" />
            </div>
          </Avatar>
        </div>
      </motion.div>
    </Link>
  );
}
