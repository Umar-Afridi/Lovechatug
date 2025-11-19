'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


const getInitials = (name: string) => (name ? name.split(' ').map(n => n[0]).join('') : 'U');

const applyNameColor = (name: string, color?: UserProfile['nameColor']) => {
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
};

const getColorBadge = (color: UserProfile['nameColor']) => {
     if (!color || color === 'default') {
         return <Badge variant="outline">Default</Badge>
     }
     
     const badgeStyle: Record<NonNullable<UserProfile['nameColor']>, string> = {
         default: '',
         gradient: 'bg-gradient-to-r from-green-400 to-purple-500 text-white border-transparent',
         green: 'bg-green-500/20 text-green-700 border-green-500/50',
         yellow: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50',
         pink: 'bg-pink-500/20 text-pink-700 border-pink-500/50',
         purple: 'bg-purple-500/20 text-purple-700 border-purple-500/50',
         red: 'bg-red-500/20 text-red-700 border-red-500/50',
     }

     return <Badge className={cn('capitalize', badgeStyle[color])}>{color}</Badge>
}

const UserListItem = ({ user }: { user: UserProfile }) => (
  <div key={user.uid} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex items-center gap-4">
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
    {user.nameColor !== 'default' && getColorBadge(user.nameColor)}
  </div>
);


const StatusUserList = ({ type }: { type: 'verified' | 'colorful' }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!firestore) return;
      setLoading(true);

      const usersRef = collection(firestore, 'users');
      let q;

      if (type === 'verified') {
        q = query(usersRef, where('verifiedBadge.showBadge', '==', true));
      } else {
        // Firestore doesn't support 'not-equal' queries directly.
        // We can query for each color or fetch all and filter. Fetching all is simpler for a limited number of users.
        // For larger scale, multiple queries would be better.
        q = query(usersRef, orderBy('nameColor'));
      }

      try {
        const querySnapshot = await getDocs(q);
        let usersList = querySnapshot.docs.map(doc => doc.data() as UserProfile);

        if (type === 'colorful') {
          usersList = usersList.filter(user => user.nameColor && user.nameColor !== 'default');
        }

        setUsers(usersList);
      } catch (error) {
        console.error(`Error fetching ${type} users:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [firestore, type]);

  if (loading) {
    return <div className="p-4 text-center">Loading users...</div>;
  }

  if (users.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No users with this status found.</div>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-2 p-2">
        {users.map((user) => (
          <UserListItem key={user.uid} user={user} />
        ))}
      </div>
    </ScrollArea>
  );
};


export default function StatusUsersPage() {
  return (
    <>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Verified & Colorful Name Users</h2>
      </div>
      <Tabs defaultValue="verified" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 m-4">
          <TabsTrigger value="verified">Verified Users</TabsTrigger>
          <TabsTrigger value="colorful">Colorful Name Users</TabsTrigger>
        </TabsList>
        <TabsContent value="verified" className="flex-1">
          <StatusUserList type="verified" />
        </TabsContent>
        <TabsContent value="colorful" className="flex-1">
          <StatusUserList type="colorful" />
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
