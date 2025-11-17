'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { ArrowLeft, BellRing, CheckCheck, Palette, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Notification, UserProfile } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OfficialBadge } from '@/components/ui/official-badge';


function applyNameColor(name: string, color?: UserProfile['nameColor']) {
    if (!color || color === 'default') {
        return name;
    }
    if (color === 'gradient') {
        return <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate">{name}</span>;
    }
    
    const colorClasses: Record<Exclude<NonNullable<UserProfile['nameColor']>, 'default' | 'gradient'>, string> = {
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };

    return <span className={cn('font-bold', colorClasses[color])}>{name}</span>;
}

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
    switch (type) {
        case 'verification_approved':
        case 'verification_rejected':
            return <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full"><CheckCheck className="h-4 w-4 text-blue-500" /></div>;
        case 'colorful_name_granted':
             return <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full"><Palette className="h-4 w-4 text-pink-500" /></div>;
        case 'verified_badge_removed':
             return <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full"><ShieldOff className="h-4 w-4 text-destructive" /></div>;
        case 'colorful_name_removed':
             return <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full"><Palette className="h-4 w-4 text-destructive" /></div>;
        default:
             return <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full"><BellRing className="h-4 w-4 text-gray-500" /></div>;
    }
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
};


export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch notifications
  useEffect(() => {
    if (!user || !firestore) return;
    setLoading(true);
    
    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Notification);
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Mark notifications as read
  useEffect(() => {
    if (!user || !firestore || notifications.length === 0) return;
    
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(firestore);
    unreadNotifications.forEach(n => {
      const notifRef = doc(firestore, 'users', user.uid, 'notifications', n.id);
      batch.update(notifRef, { isRead: true });
    });

    batch.commit().catch(err => console.error("Error marking notifications as read: ", err));

  }, [user, firestore, notifications]);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Notifications</h1>
      </header>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
            <div>
              <BellRing className="mx-auto h-16 w-16 text-gray-400" />
              <h2 className="mt-4 text-xl font-semibold">No Notifications Yet</h2>
              <p className="mt-2 text-sm">When you have new notifications, they'll show up here.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map(n => (
              <div key={n.id} className={cn("p-4 flex items-start gap-4", !n.isRead && "bg-primary/5")}>
                 <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={n.senderPhotoURL} />
                        <AvatarFallback>{getInitials(n.senderName)}</AvatarFallback>
                    </Avatar>
                     <NotificationIcon type={n.type} />
                </div>

                <div className="flex-1">
                   <div className="flex items-center gap-2">
                        <p className="font-bold">{applyNameColor(n.senderName ?? 'System', n.senderNameColor)}</p>
                        {n.senderOfficialBadge?.isOfficial && (
                            <OfficialBadge color={n.senderOfficialBadge.badgeColor} size="icon" className="h-4 w-4" />
                        )}
                   </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground/80 mt-1">{formatTimestamp(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
