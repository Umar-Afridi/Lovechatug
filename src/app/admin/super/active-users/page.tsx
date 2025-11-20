'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';
import { cn, applyNameColor } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';

type TimeRange = 'daily' | 'weekly' | 'monthly';
type ScoreField = 'dailyActivityScore' | 'weeklyActivityScore' | 'monthlyActivityScore';

const getInitials = (name: string) => (name ? name.split(' ').map(n => n[0]).join('') : 'U');

const RankingBadge = ({ rank }: { rank: number }) => {
  if (rank > 3) return null;
  const colors: Record<number, string> = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-gray-300 text-gray-800',
    3: 'bg-yellow-600 text-white',
  };
  const text: Record<number, string> = {
    1: '1st',
    2: '2nd',
    3: '3rd',
  };
  return (
    <Badge className={cn('flex items-center gap-1 font-bold', colors[rank])}>
      <Crown className="h-3 w-3" />
      {text[rank]}
    </Badge>
  );
};

const UserRankItem = ({ user, rank, scoreField }: { user: UserProfile, rank: number, scoreField: ScoreField }) => (
  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex items-center gap-4">
      <span className="font-bold text-lg w-6 text-center text-muted-foreground">{rank}</span>
      <Avatar className="h-12 w-12">
        <AvatarImage src={user.photoURL} />
        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
      </Avatar>
      <div>
        <div className="flex items-center gap-2">
            <p className="font-semibold">{applyNameColor(user.displayName, user.nameColor)}</p>
            {user.verifiedBadge?.showBadge && <VerifiedBadge color={user.verifiedBadge.badgeColor} />}
            {user.officialBadge?.isOfficial && <OfficialBadge color={user.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={user.canManageOfficials} />}
        </div>
        <p className="text-xs text-muted-foreground">@{user.username}</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="font-bold text-lg">{user[scoreField] || 0}</p>
        <p className="text-xs text-muted-foreground">Score</p>
      </div>
      <RankingBadge rank={rank} />
    </div>
  </div>
);

const Leaderboard = ({ timeRange }: { timeRange: TimeRange }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  const scoreField: ScoreField = `${timeRange}ActivityScore` as ScoreField;

  useEffect(() => {
    if (!firestore) return;
    setLoading(true);

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, orderBy(scoreField, 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersList = querySnapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching ${timeRange} leaderboard:`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, timeRange, scoreField]);

  if (loading) {
    return <div className="p-4 text-center">Loading leaderboard...</div>;
  }

  if (users.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No active users found for this period.</div>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-2 p-2">
        {users.map((user, index) => (
          <UserRankItem key={user.uid} user={user} rank={index + 1} scoreField={scoreField} />
        ))}
      </div>
    </ScrollArea>
  );
};

export default function ActiveUsersPage() {
  return (
    <>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Active Users Leaderboard</h2>
      </div>
      <Tabs defaultValue="daily" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 m-4">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="flex-1">
          <Leaderboard timeRange="daily" />
        </TabsContent>
        <TabsContent value="weekly" className="flex-1">
          <Leaderboard timeRange="weekly" />
        </TabsContent>
        <TabsContent value="monthly" className="flex-1">
          <Leaderboard timeRange="monthly" />
        </TabsContent>
      </Tabs>
      <div className="p-4 border-t">
        <Button variant="outline" asChild>
          <Link href="/admin/super">Back to Admin Hub</Link>
        </Button>
      </div>
    </>
  );
}
