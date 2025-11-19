'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { cn, applyNameColor } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const BadgeColors: Array<NonNullable<UserProfile['verifiedBadge']>['badgeColor']> = ['blue', 'gold', 'green', 'red', 'pink'];


export default function ManageVerificationPage() {
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
    
    try {
        const querySnapshot = await getDocs(q);
        let usersList = querySnapshot.docs.map(d => d.data() as UserProfile);

        if (!currentUserProfile.canManageOfficials) {
            usersList = usersList.filter(u => u.uid === authUser?.uid || !u.officialBadge?.isOfficial);
        }
        
        setSearchedUsers(usersList);
    } catch (error) {
        console.error("Error searching users:", error);
        toast({ title: 'Search Error', description: 'Could not perform search.', variant: 'destructive'});
    } finally {
        setSearching(false);
    }
  }, [firestore, searchQuery, currentUserProfile, authUser, toast]);

  const sendNotification = async (targetUser: UserProfile, status: 'approved' | 'rejected' | 'removed') => {
    if (!firestore || !currentUserProfile) return;
    const adminName = currentUserProfile.displayName;

    let title = '';
    let message = '';
    let type: 'verification_approved' | 'verification_rejected' | 'verified_badge_removed';

    switch(status) {
        case 'approved':
            title = 'Profile Verified!';
            message = `Congratulations! ${adminName} has verified your profile.`;
            type = 'verification_approved';
            break;
        case 'rejected':
            title = 'Verification Update';
            message = `Your verification request was not approved by ${adminName} at this time. Please ensure your profile information is complete and try again later.`;
            type = 'verification_rejected';
            break;
        case 'removed':
            title = 'Verification Update';
            message = `Your verified badge has been removed by ${adminName}.`;
            type = 'verified_badge_removed';
            break;
    }

    const notification: any = {
        userId: targetUser.uid,
        title: adminName,
        message: message,
        type: type as const,
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

  const handleUpdateVerification = async (targetUser: UserProfile, status: 'approved' | 'rejected' | 'none' | 'pending', color?: UserProfile['verifiedBadge']['badgeColor']) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    
    const wasPreviouslyApproved = targetUser.verifiedBadge?.showBadge;

    const updatePayload: any = {
      'verificationApplicationStatus': status,
      'verifiedBadge.showBadge': status === 'approved',
      'verifiedBadge.badgeColor': status === 'approved' ? (color || 'blue') : (targetUser.verifiedBadge?.badgeColor || 'blue'),
    };
    
    try {
      await updateDoc(userRef, updatePayload);
      
      // OPTIMISTIC UI UPDATE: Update local state immediately for faster feedback
      setSearchedUsers(prevUsers => 
        prevUsers.map(u => 
          u.uid === targetUser.uid 
            ? { ...u, ...updatePayload, verifiedBadge: { ...u.verifiedBadge, ...updatePayload.verifiedBadge } } 
            : u
        )
      );

      if (status === 'approved') {
        await sendNotification(targetUser, 'approved');
      } else if (status === 'rejected') {
        await sendNotification(targetUser, 'rejected');
      } else if (status === 'none' && wasPreviouslyApproved) {
        await sendNotification(targetUser, 'removed');
      }

      toast({
        title: 'Verification Status Updated',
        description: `${targetUser.displayName}'s status is now '${status}'.`,
      });
    } catch (error) {
       toast({ title: 'Error', description: 'Could not update verification status.', variant: 'destructive'});
       console.error("Error updating verification status:", error);
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
        {searchedUsers.length > 0 ? (
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
                                    {user.verifiedBadge?.showBadge && <VerifiedBadge color={user.verifiedBadge.badgeColor}/>}
                                    {user.officialBadge?.isOfficial && <OfficialBadge color={user.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={user.canManageOfficials}/>}
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
