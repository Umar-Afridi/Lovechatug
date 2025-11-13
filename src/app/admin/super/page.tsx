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
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import {
  ArrowLeft,
  MoreVertical,
  Search,
  Trash2,
  Ban,
  UserCog,
  CheckCheck,
  Sparkles,
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import Link from 'next/link';

export default function SuperAdminPage() {
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
    action: 'disable' | 'delete' | null;
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
        // User doc doesn't exist, so they can't be an admin
        router.push('/chat');
      }
    });
    return () => unsubscribe();
  }, [authUser, firestore, router, toast]);

  // 2. Fetch all users
  useEffect(() => {
    if (!currentUserProfile?.officialBadge?.isOfficial || !firestore) return;

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map((d) => d.data() as UserProfile)
        .filter(u => u.uid !== authUser?.uid); // Exclude self
      setAllUsers(usersList);
      setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: 'users', operation: 'list'});
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile?.officialBadge?.isOfficial, firestore, authUser?.uid]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return allUsers;
    return allUsers.filter(u => 
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allUsers]);

  const openConfirmationDialog = (action: 'disable' | 'delete', targetUser: UserProfile) => {
    setDialogState({ isOpen: true, action, targetUser });
  };

  const handleDisableUser = async (targetUser: UserProfile) => {
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
      const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'update' });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (!firestore || !targetUser) return;
    
    // This is a placeholder for a Cloud Function call
    // Directly deleting a user from the client-side is not secure or possible with default rules.
    // In a real app, this would trigger a Cloud Function.
    // For this prototype, we'll just delete their Firestore document for demonstration.
    
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
       const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'delete' });
       errorEmitter.emit('permission-error', permissionError);
    }
  };
  
  const handleConfirmAction = () => {
    if (!dialogState.targetUser || !dialogState.action) return;

    if (dialogState.action === 'disable') {
        handleDisableUser(dialogState.targetUser);
    } else if (dialogState.action === 'delete') {
        handleDeleteUser(dialogState.targetUser);
    }
    
    setDialogState({ isOpen: false, action: null, targetUser: null });
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  if (loading || !currentUserProfile?.officialBadge?.isOfficial) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading Admin Panel...</p>
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
                : `This will ${dialogState.targetUser?.isDisabled ? 're-enable' : 'disable'} ${dialogState.targetUser?.displayName}'s account, ${dialogState.targetUser?.isDisabled ? 'allowing them to log in again.' : 'preventing them from logging in.'}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} className={dialogState.action === 'delete' ? "bg-destructive hover:bg-destructive/90" : ""}>
                Yes, {dialogState.action === 'delete' ? 'delete' : (dialogState.targetUser?.isDisabled ? 'enable' : 'disable')} user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <div className="p-4 border-b space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button asChild variant="outline">
                    <Link href="/admin/super/verification">
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Manage Verification
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/super/colorful-name">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Manage Colorful Names
                    </Link>
                </Button>
            </div>
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
            {filteredUsers.length > 0 ? (
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
                                        <p className="font-semibold truncate">{user.displayName}</p>
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
                                    <DropdownMenuItem onClick={() => openConfirmationDialog('disable', user)}>
                                        <Ban className="mr-2 h-4 w-4" />
                                        <span>{user.isDisabled ? 'Enable' : 'Disable'} Account</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openConfirmationDialog('delete', user)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete Account</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground p-8">
                    <p>{searchQuery ? 'No users found.' : 'No other users in the system.'}</p>
                </div>
            )}
            
          </ScrollArea>
    </>
  );
}
