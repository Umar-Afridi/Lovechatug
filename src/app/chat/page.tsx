'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  MessageSquare,
  Phone,
  Settings,
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
  doc,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import type { Chat } from '@/lib/types';
import ChatListPage from './list/page';
import CallsPage from './calls/page';
import SettingsPage from '@/app/settings/page';

const TABS = ['chats', 'calls', 'settings'];

export default function ChatMainPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();

  const [api, setApi] = useState<CarouselApi>();
  const [activeTab, setActiveTab] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [callCount, setCallCount] = useState(0);

  // Effect to set initial tab based on URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    const initialTab = TABS.indexOf(tab || 'chats');
    if (api && initialTab !== -1) {
      api.scrollTo(initialTab, true);
      setActiveTab(initialTab);
    }
  }, [searchParams, api]);

  // Effect to update URL when swiping
  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => {
      const newTab = api.selectedScrollSnap();
      setActiveTab(newTab);
      const newPath = `/chat?tab=${TABS[newTab]}`;
      // Use replaceState to avoid adding to browser history on swipe
      window.history.replaceState(
        { ...window.history.state, as: newPath, url: newPath },
        '',
        newPath
      );
    };

    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  const handleTabClick = (index: number) => {
    if (api) {
      api.scrollTo(index);
    }
  };

  // Unread counts effects
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(
      chatsRef,
      where('members', 'array-contains', user.uid)
    );
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      let totalUnread = 0;
      snapshot.forEach((doc) => {
        const chat = doc.data() as Chat;
        totalUnread += chat.unreadCount?.[user.uid] ?? 0;
      });
      setInboxCount(totalUnread);
    });

    const callsRef = collection(firestore, 'calls');
    const callsQuery = query(
      callsRef,
      where('receiverId', '==', user.uid),
      where('status', '==', 'missed')
      // Note: we can't check for isRead here without a composite index,
      // so we might have to handle read status on the client.
      // For now, this just counts missed calls.
    );
    const unsubCalls = onSnapshot(callsQuery, (snapshot) => {
      setCallCount(snapshot.size);
    });

    return () => {
      unsubChats();
      unsubCalls();
    };
  }, [firestore, user?.uid]);

  const tabItems = [
    {
      icon: MessageSquare,
      label: 'Chats',
      count: inboxCount,
    },
    {
      icon: Phone,
      label: 'Calls',
      count: callCount,
    },
    {
      icon: Settings,
      label: 'Settings',
      count: 0,
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold text-primary">Lo Chat</h1>
        <nav className="mt-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
            {tabItems.map((item, index) => (
              <Button
                key={item.label}
                variant={activeTab === index ? 'default' : 'ghost'}
                onClick={() => handleTabClick(index)}
                className={cn(
                  activeTab === index
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.count > 0 && (
                     <Badge variant="destructive" className="absolute -top-2 -right-2 h-4 w-4 justify-center p-0 text-[10px]">{item.count}</Badge>
                  )}
                </div>
                <span className="ml-2 hidden sm:inline">{item.label}</span>
              </Button>
            ))}
          </div>
        </nav>
      </header>

      <Carousel setApi={setApi} className="flex-1 overflow-hidden">
        <CarouselContent>
          <CarouselItem>
            <ChatListPage />
          </CarouselItem>
          <CarouselItem>
            <CallsPage />
          </CarouselItem>
          <CarouselItem>
            <SettingsPage />
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    </div>
  );
}
