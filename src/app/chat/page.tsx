'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Settings,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import ChatListPage from './list/page';

export default function ChatMainPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    if (!user || !firestore) return;

    const notificationsRef = collection(firestore, 'users', user.uid, 'notifications');
    const qNotifications = query(notificationsRef, where('isRead', '==', false));
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
        setUnreadNotificationCount(snapshot.size);
    });
    
    return () => {
        unsubscribeNotifications();
    };

  }, [user, firestore]);


  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/95 z-10">
        <h1 className="text-2xl font-bold text-primary">Love Chat</h1>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <Search className="h-5 w-5" />
            </Button>
             <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full" asChild>
                <Link href="/chat/notifications">
                  <Bell className="h-5 w-5" />
                  {unreadNotificationCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadNotificationCount}</Badge>
                  )}
                  <span className="sr-only">Notifications</span>
                </Link>
             </Button>
             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" asChild>
                <Link href="/settings">
                    <Settings className="h-5 w-5" />
                </Link>
             </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <ChatListPage />
      </div>
    </div>
  );
}
