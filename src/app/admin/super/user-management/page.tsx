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
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  MoreVertical,
  Search,
  Trash2,
  Ban,
  AlertTriangle,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';


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


export default function ManageUsersPage() {
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    action: 'disable' | 'delete' | 'enable' | 'warn' | null;
    targetUser: UserProfile | null;
  }>({ isOpen: false, action: null, targetUser: null });

  // 1. Authorization check
  useEffect(() => {
    if (!authUser || !firestore) return;
    const userDocRef = doc(firestore, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setCurrentUserProfile(profile);
        if (!profile.officialBadge?.isOfficial) {
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to access this page.',
            variant: 'destructive',
          });
          router.push('/chat');
        }
      } else {
        router.push('/chat');
      }
    }, (error) => {
        console.error("Error fetching admin profile:", error);
    });
    return () => unsubscribe();
  }, [authUser, firestore, router, toast]);

  // 2. Fetch all users, excluding other official users
  useEffect(() => {
    if (!currentUserProfile?.officialBadge?.isOfficial || !firestore || !authUser) return;

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map((d) => d.data() as UserProfile)
        // Exclude other official users, but keep self in the list
        .filter(u => u.uid === authUser.uid || !u.officialBadge?.isOfficial); 
      setAllUsers(usersList);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile?.officialBadge?.isOfficial, firestore, authUser]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return []; // Don't show any users if search is empty
    return allUsers.filter(u => 
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allUsers]);

  const openConfirmationDialog = (action: 'disable' | 'delete' | 'enable' | 'warn', targetUser: UserProfile) => {
    setDialogState({ isOpen: true, action, targetUser });
  };

  const handleSendWarning = async (targetUser: UserProfile) => {
    if (!firestore || !currentUserProfile) return;
    
    const notification: any = {
        userId: targetUser.uid,
        title: currentUserProfile.displayName,
        message: "You have received a warning from the administration. Please adhere to the community guidelines to avoid account suspension.",
        type: 'warning' as const,
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: currentUserProfile.uid,
        senderName: currentUserProfile.displayName,
        senderPhotoURL: currentUserProfile.photoURL,
        senderOfficialBadge: currentUserProfile.officialBadge,
        senderNameColor: currentUserProfile.nameColor,
    };
    try {
        await addDoc(collection(firestore, 'users', targetUser.uid, 'notifications'), notification);
        toast({
            title: 'Warning Sent',
            description: `A warning notification has been sent to ${targetUser.displayName}.`,
        });
    } catch (error) {
         toast({ title: 'Error', description: 'Could not send warning.', variant: 'destructive'});
         console.error("Error sending warning:", error);
    }
  }

  const handleToggleDisableUser = async (targetUser: UserProfile) => {
    if (!firestore || !targetUser) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    const newDisabledState = !targetUser.isDisabled;
    try {
      await updateDoc(userRef, { isDisabled: newDisabledState });
      toast({
        title: `User ${newDisabledState ? 'Disabled' : 'Enabled'}`,
        description: `${targetUser.displayName}'s account has been ${newDisabledState ? 'disabled' : 're-enabled'}.`,
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not update user status.', variant: 'destructive'});
      console.error("Error toggling disable user:", error);
    }
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (!firestore || !targetUser) return;
    
    const userRef = doc(firestore, 'users', targetUser.uid);
     try {
      await deleteDoc(userRef);
      toast({
        title: 'User Deleted',
        description: `${targetUser.displayName}'s data has been removed from Firestore. (Auth record not removed in prototype).`,
        variant: 'destructive',
      });
    } catch (error) {
       toast({ title: 'Error', description: 'Could not delete user data.', variant: 'destructive'});
       console.error("Error deleting user:", error);
    }
  };
  
  const handleConfirmAction = () => {
    if (!dialogState.targetUser || !dialogState.action) return;

    if (dialogState.action === 'disable' || dialogState.action === 'enable') {
        handleToggleDisableUser(dialogState.targetUser);
    } else if (dialogState.action === 'delete') {
        handleDeleteUser(dialogState.targetUser);
    } else if (dialogState.action === 'warn') {
        handleSendWarning(dialogState.targetUser);
    }
    
    setDialogState({ isOpen: false, action: null, targetUser: null });
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  if (loading || !currentUserProfile?.officialBadge?.isOfficial) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading User Management Panel...</p>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={dialogState.isOpen} onOpenChange={(isOpen) => !isOpen && setDialogState({ isOpen: false, action: null, targetUser: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                {dialogState.action === 'delete'
                ? `This will permanently delete ${dialogState.targetUser?.displayName}'s account data from Firestore. This action cannot be undone.`
                : dialogState.action === 'warn' 
                ? `This will send a formal warning to ${dialogState.targetUser?.displayName}.`
                : `This will ${dialogState.targetUser?.isDisabled ? 're-enable' : 'disable'} ${dialogState.targetUser?.displayName}'s account, ${dialogState.targetUser?.isDisabled ? 'allowing them to log in again.' : 'preventing them from logging in.'}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} className={cn(
                dialogState.action === 'delete' && "bg-destructive hover:bg-destructive/90",
                dialogState.action === 'warn' && "bg-yellow-500 hover:bg-yellow-600 dark:text-background"
            )}>
                Yes, {dialogState.action === 'delete' ? 'delete' : dialogState.action === 'warn' ? 'send warning' : (dialogState.targetUser?.isDisabled ? 'enable' : 'disable')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <div className="p-4 border-b space-y-4">
             <div className="relative">
                <Input 
                    placeholder="Search by username or display name..."
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
                        <div key={user.uid} className={cn("flex items-center justify-between p-2 rounded-lg", user.isDisabled && "bg-destructive/10")}>
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
                                    {user.isDisabled && <p className="text-xs font-bold text-destructive">DISABLED</p>}
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openConfirmationDialog('warn', user)} className="text-yellow-600 dark:text-yellow-500 focus:bg-yellow-500/10 focus:text-yellow-600 dark:focus:text-yellow-500">
                                        <AlertTriangle className="mr-2 h-4 w-4" />
                                        <span>Send Warning</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openConfirmationDialog(user.isDisabled ? 'enable' : 'disable', user)}>
                                        <Ban className="mr-2 h-4 w-4" />
                                        <span>{user.isDisabled ? 'Enable' : 'Disable'} Account</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openConfirmationDialog('delete', user)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete (Hard)</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground p-8 h-full">
                    <p>{searchQuery ? 'No users found.' : 'Search for a user to manage their account.'}</p>
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
