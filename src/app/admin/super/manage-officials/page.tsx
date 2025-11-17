'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Shield,
  MoreVertical,
  Search,
  Palette,
  ShieldCheck,
  ShieldOff,
  Crown,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { OfficialBadge } from '@/components/ui/official-badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { Separator } from '@/components/ui/separator';

const BadgeColors: Array<NonNullable<UserProfile['officialBadge']>['badgeColor']> = ['blue', 'gold', 'green', 'red', 'pink'];
const SYSTEM_SENDER_ID = 'system_lovechat';
const SYSTEM_SENDER_NAME = 'Love Chat';
const SYSTEM_SENDER_PHOTO_URL = 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/UG_LOGO_RED.png?alt=media&token=e632b0a9-4678-4384-9549-01e403d5b00c';


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

const UserListItem = ({ user, onUpdate }: { user: UserProfile, onUpdate: (targetUser: UserProfile, isOfficial: boolean, color?: UserProfile['officialBadge']['badgeColor']) => void }) => {
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';
    
    return (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
            <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user.photoURL} />
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{applyNameColor(user.displayName, user.nameColor)}</p>
                        {user.verifiedBadge?.showBadge && <VerifiedBadge color={user.verifiedBadge.badgeColor}/>}
                        {user.officialBadge?.isOfficial && <OfficialBadge color={user.officialBadge.badgeColor} size="icon" className="h-4 w-4"/>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Manage Official Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                         <DropdownMenuSub>
                            <DropdownMenuSubTrigger disabled={user.officialBadge?.isOfficial}>
                                <ShieldCheck className="mr-2 h-4 w-4 text-green-500" />
                                <span>Make Official</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuLabel>Choose Badge Color</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {BadgeColors.map(color => (
                                        <DropdownMenuItem 
                                            key={color} 
                                            onClick={() => onUpdate(user, true, color)}
                                            className="capitalize flex items-center gap-2"
                                        >
                                            <Palette className="h-4 w-4" style={{ color }}/>
                                            {color}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => onUpdate(user, false)} disabled={!user.officialBadge?.isOfficial} className="text-destructive focus:text-destructive">
                            <ShieldOff className="mr-2 h-4 w-4" />
                            <span>Remove Official</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};


export default function ManageOfficialsPage() {
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [officialUsers, setOfficialUsers] = useState<UserProfile[]>([]);
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
        if (!profile.officialBadge?.isOfficial || !profile.canManageOfficials) {
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
    if (!currentUserProfile?.canManageOfficials || !firestore || !authUser) return;

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map((d) => d.data() as UserProfile);
      
      const officials = usersList.filter(u => u.officialBadge?.isOfficial && u.uid !== authUser.uid);
      const others = usersList.filter(u => !u.officialBadge?.isOfficial);

      setOfficialUsers(officials);
      setAllUsers(others); // `allUsers` will now only contain non-officials for searching
      setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile?.canManageOfficials, firestore, authUser]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return []; 
    return allUsers.filter(u => 
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allUsers]);
  
  const handleUpdateOfficialStatus = async (targetUser: UserProfile, isOfficial: boolean, color?: UserProfile['officialBadge']['badgeColor']) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    
    let updatePayload: any = {
      'officialBadge.isOfficial': isOfficial,
    };

    if (isOfficial) {
      updatePayload['officialBadge.badgeColor'] = color || 'gold';
    }

    try {
      await updateDoc(userRef, updatePayload);
      
      toast({
        title: 'Official Status Updated',
        description: `${targetUser.displayName} is ${isOfficial ? 'now an official user' : 'no longer an official user'}.`,
      });
    } catch (error) {
       toast({ title: 'Error', description: 'Could not update official status.', variant: 'destructive'});
       console.error("Error updating official status:", error);
    }
  };


  if (loading || !currentUserProfile?.canManageOfficials) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading Official Management Panel...</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Manage Officials</h2>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
             <h3 className="text-md font-semibold text-muted-foreground">Add New Official</h3>
            <div className="relative">
                <Input 
                    placeholder="Search users to make official..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
            {searchQuery && filteredUsers.length > 0 ? (
                <div className="space-y-2">
                    {filteredUsers.map((user) => (
                       <UserListItem key={user.uid} user={user} onUpdate={handleUpdateOfficialStatus} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground p-8 h-full">
                    <p>{searchQuery ? "No users found." : "Search for a user to manage their official status."}</p>
                </div>
            )}
        </div>

        <Separator className="my-4" />
        
         <div className="p-4">
            <h3 className="text-md font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><Crown className="h-5 w-5 text-yellow-500" /> Current Officials</h3>
            {officialUsers.length > 0 ? (
                <div className="space-y-2 rounded-lg border p-2">
                    {officialUsers.map((user) => (
                        <UserListItem key={user.uid} user={user} onUpdate={handleUpdateOfficialStatus} />
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground p-4 border rounded-lg border-dashed">
                    <p>No other official users found.</p>
                </div>
            )}
        </div>
      </ScrollArea>
       <div className="p-4 border-t">
          <Button variant="outline" asChild>
            <Link href="/admin/super">Back to Admin Hub</Link>
          </Button>
        </div>
    </>
  );
}
