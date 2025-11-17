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
import { ArrowLeft, BellRing, CheckCheck, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
    switch (type) {
        case 'verification_approved':
        case 'verification_rejected':
            return <CheckCheck className="h-5 w-5 text-blue-500" />;
        case 'colorful_name_granted':
            return <Palette className="h-5 w-5 text-pink-500" />;
        default:
            return <BellRing className="h-5 w-5 text-gray-500" />;
    }
}

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
                 <NotificationIcon type={n.type} />
                <div className="flex-1">
                  <p className="font-bold">{n.title}</p>
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
