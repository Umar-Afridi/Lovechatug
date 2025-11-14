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
  CheckCheck,
  MoreVertical,
  Search,
  XCircle,
  Clock,
  CircleDotDashed,
  Palette,
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const BadgeColors: Array<UserProfile['verifiedBadge']['badgeColor']> = ['blue', 'gold', 'green', 'red', 'pink'];

export default function ManageVerificationPage() {
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
        const permissionError = new FirestorePermissionError({ path: 'users', operation: 'list'});
        errorEmitter.emit('permission-error', permissionError);
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

  const handleUpdateVerification = async (targetUser: UserProfile, status: 'approved' | 'rejected' | 'none' | 'pending', color?: UserProfile['verifiedBadge']['badgeColor']) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    
    let updatePayload: any = {
      'verificationApplicationStatus': status,
    };

    if (status === 'approved') {
      updatePayload['verifiedBadge'] = {
        showBadge: true,
        badgeColor: color || 'blue',
      };
    } else {
       updatePayload['verifiedBadge'] = {
        showBadge: false,
        badgeColor: targetUser.verifiedBadge?.badgeColor || 'blue', // Keep old color
      };
    }

    try {
      await updateDoc(userRef, updatePayload);
      toast({
        title: 'Verification Status Updated',
        description: `${targetUser.displayName}'s status is now '${status}'.`,
      });
    } catch (error) {
       toast({ title: 'Error', description: 'Could not update verification status.', variant: 'destructive'});
       const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updatePayload });
       errorEmitter.emit('permission-error', permissionError);
    }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  const getStatusBadge = (status: UserProfile['verificationApplicationStatus']) => {
      switch(status) {
          case 'approved':
              return <Badge variant="secondary" className="text-green-600 border-green-600/50"><CheckCheck className="mr-1 h-3 w-3"/>Approved</Badge>;
          case 'pending':
              return <Badge variant="secondary" className="text-yellow-600 border-yellow-600/50"><Clock className="mr-1 h-3 w-3"/>Pending</Badge>;
          case 'rejected':
              return <Badge variant="destructive" className="text-red-600"><XCircle className="mr-1 h-3 w-3"/>Rejected</Badge>;
          case 'none':
          default:
              return <Badge variant="outline"><CircleDotDashed className="mr-1 h-3 w-3"/>None</Badge>;
      }
  };

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
            <CheckCheck className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Manage Verification</h2>
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
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold truncate">{user.displayName}</p>
                                    {user.verifiedBadge?.showBadge && <VerifiedBadge color={user.verifiedBadge.badgeColor}/>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                           {getStatusBadge(user.verificationApplicationStatus)}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                     <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <CheckCheck className="mr-2 h-4 w-4 text-green-500" />
                                            <span>Approve</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                <DropdownMenuLabel>Choose Badge Color</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {BadgeColors.map(color => (
                                                    <DropdownMenuItem 
                                                        key={color} 
                                                        onClick={() => handleUpdateVerification(user, 'approved', color)}
                                                        className="capitalize flex items-center gap-2"
                                                    >
                                                        <Palette className="h-4 w-4" style={{ color }}/>
                                                        {color}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>

                                    <DropdownMenuItem onClick={() => handleUpdateVerification(user, 'rejected')}>
                                        <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                        <span>Reject</span>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => handleUpdateVerification(user, 'pending')}>
                                        <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                                        <span>Set to Pending</span>
                                    </DropdownMenuItem>
                                     <DropdownMenuSeparator />
                                     <DropdownMenuItem onClick={() => handleUpdateVerification(user, 'none')}>
                                        <CircleDotDashed className="mr-2 h-4 w-4" />
                                        <span>Remove Badge</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground p-8 h-full">
                <p>{searchQuery ? "No users found." : "Search for a user to manage their verification."}</p>
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
