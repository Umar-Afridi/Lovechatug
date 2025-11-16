'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  Sparkles,
  Search,
  MoreVertical,
  Palette,
  XCircle,
  Paintbrush,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

type NameColor = NonNullable<UserProfile['nameColor']>;
const NAME_COLORS: NameColor[] = ['gradient', 'green', 'yellow', 'pink', 'purple', 'red'];

function applyNameColor(name: string, color?: NameColor) {
    if (!color || color === 'default') {
        return name;
    }
    if (color === 'gradient') {
        return <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate">{name}</span>;
    }
    
    const colorClasses: Record<NameColor, string> = {
        default: '',
        gradient: '',
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };

    return <span className={cn('font-bold', colorClasses[color])}>{name}</span>;
}

export default function ManageColorfulNamePage() {
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Authorization check
  useEffect(() => {
    if (!authUser || !firestore) return;
    const userDocRef = doc(firestore, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setCurrentUserProfile(profile);
        if (!profile.officialBadge?.isOfficial) {
          router.push('/chat');
        }
      } else {
        router.push('/chat');
      }
    }, (error) => {
        console.error("Error fetching admin profile:", error);
    });
    return () => unsubscribe();
  }, [authUser, firestore, router]);

  // Fetch all users
  useEffect(() => {
    if (!currentUserProfile?.officialBadge?.isOfficial || !firestore) return;

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map((d) => d.data() as UserProfile)
        .filter(u => !u.officialBadge?.isOfficial);
      setAllUsers(usersList);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile?.officialBadge?.isOfficial, firestore]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return []; // Don't show any users if search is empty
    return allUsers.filter(u => 
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allUsers]);

  const handleUpdateNameColor = async (targetUser: UserProfile, color: NameColor | 'default') => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    try {
      await updateDoc(userRef, { nameColor: color });
      toast({
        title: `Name Color Updated`,
        description: `${targetUser.displayName}'s name color has been set to ${color}.`,
      });
    } catch (error) {
       toast({ title: 'Error', description: 'Could not update name color.', variant: 'destructive'});
       console.error("Error updating name color:", error);
    }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';
  
  const getColorBadge = (color: NameColor | undefined) => {
     if (!color || color === 'default') {
         return <Badge variant="outline">Default</Badge>
     }
     
     const badgeStyle: Record<NameColor, string> = {
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

  if (loading || !currentUserProfile?.officialBadge?.isOfficial) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading Management Panel...</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Manage Name Colors</h2>
        </div>
        <div className="relative">
            <Input 
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {searchQuery && filteredUsers.length > 0 ? (
            <div className="space-y-2 p-2">
                {filteredUsers.map((user) => (
                    <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user.photoURL} />
                                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="overflow-hidden">
                                <p className="font-semibold truncate">{applyNameColor(user.displayName, user.nameColor)}</p>
                                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                           {getColorBadge(user.nameColor)}
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Set Name Color</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {NAME_COLORS.map(color => (
                                         <DropdownMenuItem key={color} onClick={() => handleUpdateNameColor(user, color)}>
                                             <Palette className="mr-2 h-4 w-4" />
                                             <span className="capitalize">{color}</span>
                                         </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                     <DropdownMenuItem onClick={() => handleUpdateNameColor(user, 'default')}>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        <span>Reset to Default</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground p-8 h-full">
                <p>{searchQuery ? "No users found." : "Search for a user to manage their name color."}</p>
            </div>
        )}
      </ScrollArea>
       <div className="p-4 border-t">
          <Button variant="outline" asChild>
            <Link href="/admin/super">Back to Admin Hub</Link>
          </Button>
        </div>
    </>
  );
}
