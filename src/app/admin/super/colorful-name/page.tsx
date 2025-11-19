'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  where,
} from 'firebase/firestore';
import {
  Sparkles,
  Search,
  MoreVertical,
  Palette,
  XCircle,
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
import { cn, applyNameColor } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';

type NameColor = NonNullable<UserProfile['nameColor']>;
const NAME_COLORS: NameColor[] = ['gradient', 'green', 'yellow', 'pink', 'purple', 'red'];

export default function ManageColorfulNamePage() {
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [searchedUsers, setSearchedUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

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
        } else {
            setLoading(false);
        }
      } else {
        router.push('/chat');
      }
    }, (error) => {
        console.error("Error fetching admin profile:", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [authUser, firestore, router]);

  const handleSearch = useCallback(async () => {
    if (!firestore || !currentUserProfile || searchQuery.trim().length < 2) {
      setSearchedUsers([]);
      return;
    }
    setSearching(true);
    const usersRef = collection(firestore, "users");
    const q = query(usersRef, where("username", ">=", searchQuery.toLowerCase()), where("username", "<=", searchQuery.toLowerCase() + '\uf8ff'));
    
    // Using onSnapshot for real-time updates of search results
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let usersList = querySnapshot.docs.map(d => d.data() as UserProfile);

      if (!currentUserProfile.canManageOfficials) {
          usersList = usersList.filter(u => u.uid === authUser?.uid || !u.officialBadge?.isOfficial);
      }
      
      setSearchedUsers(usersList);
      setSearching(false);
    }, (error) => {
      console.error("Error searching users:", error);
      toast({ title: 'Search Error', description: 'Could not perform search.', variant: 'destructive'});
      setSearching(false);
    });
    
    // We might need a way to unsubscribe when the search query changes or component unmounts.
    // For now, this provides real-time updates for the current search.
  }, [firestore, searchQuery, currentUserProfile, authUser, toast]);

  const sendNotification = async (targetUser: UserProfile, type: 'granted', color: NameColor | 'default') => {
    if (!firestore || !currentUserProfile) return;
    const adminName = currentUserProfile.displayName;

    const notification: any = {
        userId: targetUser.uid,
        title: adminName,
        message: `Congratulations! You have been granted the '${color}' name color by ${adminName}.`,
        type: 'colorful_name_granted' as const,
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: currentUserProfile.uid,
        senderName: currentUserProfile.displayName,
        senderPhotoURL: currentUserProfile.photoURL,
        senderOfficialBadge: currentUserProfile.officialBadge,
        senderNameColor: currentUserProfile.nameColor,
    };
    await addDoc(collection(firestore, 'users', targetUser.uid, 'notifications'), notification);
  }
  
  const sendResetNotification = async (targetUser: UserProfile) => {
     if (!firestore || !currentUserProfile) return;
      const adminName = currentUserProfile.displayName;
      
      const notification: any = {
        userId: targetUser.uid,
        title: adminName,
        message: `Your special name color has been reset by ${adminName}.`,
        type: 'colorful_name_removed' as const,
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: currentUserProfile.uid,
        senderName: currentUserProfile.displayName,
        senderPhotoURL: currentUserProfile.photoURL,
        senderOfficialBadge: currentUserProfile.officialBadge,
        senderNameColor: currentUserProfile.nameColor,
    };
    await addDoc(collection(firestore, 'users', targetUser.uid, 'notifications'), notification);
  }

  const handleUpdateNameColor = async (targetUser: UserProfile, color: NameColor | 'default') => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    const wasPreviouslyColored = targetUser.nameColor && targetUser.nameColor !== 'default';

    try {
      await updateDoc(userRef, { nameColor: color });

      if (color !== 'default') {
          await sendNotification(targetUser, 'granted', color);
      } else if (color === 'default' && wasPreviouslyColored) {
          await sendResetNotification(targetUser);
      }

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
  
  const getColorBadge = (color: UserProfile['nameColor'] | undefined) => {
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

  if (loading) {
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
        <div className="flex gap-2">
            <Input 
                placeholder="Search users by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
                <Search className="mr-2 h-4 w-4" />
                {searching ? 'Searching...' : 'Search'}
            </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {searching ? (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
        ) : searchedUsers.length > 0 ? (
            <div className="space-y-2 p-2">
                {searchedUsers.map((user) => (
                    <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user.photoURL} />
                                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="overflow-hidden">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold truncate">{applyNameColor(user.displayName, user.nameColor)}</p>
                                  {user.verifiedBadge?.showBadge && <VerifiedBadge color={user.verifiedBadge.badgeColor} />}
                                  {user.officialBadge?.isOfficial && <OfficialBadge color={user.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={user.canManageOfficials} />}
                                </div>
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
                                     <DropdownMenuItem onClick={() => handleUpdateNameColor(user, 'default')} className="text-destructive focus:text-destructive">
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
