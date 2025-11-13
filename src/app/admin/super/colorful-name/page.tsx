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
  CheckCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

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
    });
    return () => unsubscribe();
  }, [authUser, firestore, router]);

  // Fetch all users
  useEffect(() => {
    if (!currentUserProfile?.officialBadge?.isOfficial || !firestore) return;

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllUsers(snapshot.docs.map((d) => d.data() as UserProfile));
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

  const handleToggleColorfulName = async (targetUser: UserProfile) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', targetUser.uid);
    const newState = !targetUser.colorfulName;
    try {
      await updateDoc(userRef, { colorfulName: newState });
      toast({
        title: `Colorful Name ${newState ? 'Activated' : 'Deactivated'}`,
        description: `${targetUser.displayName}'s name will now be ${newState ? 'colorful' : 'plain'}.`,
      });
    } catch (error) {
       toast({ title: 'Error', description: 'Could not update colorful name status.', variant: 'destructive'});
       const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: { colorfulName: newState } });
       errorEmitter.emit('permission-error', permissionError);
    }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

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
            <h2 className="text-lg font-semibold">Manage Colorful Names</h2>
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
                                <p className={cn("font-semibold truncate", user.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate")}>{user.displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                           {user.colorfulName && <Badge variant="secondary" className="text-green-600 border-green-600/50"><CheckCircle className="mr-1 h-3 w-3" /> Active</Badge>}
                           <Button 
                             size="sm" 
                             variant={user.colorfulName ? "destructive" : "default"}
                             onClick={() => handleToggleColorfulName(user)}
                           >
                             {user.colorfulName ? 'Deactivate' : 'Activate'}
                           </Button>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground p-8 h-full">
                <p>{searchQuery ? "No users found." : "Search for a user to manage their colorful name."}</p>
            </div>
        )}
      </ScrollArea>
       <div className="p-4 border-t">
          <Button variant="outline" asChild>
            <Link href="/admin/super">Back to User Management</Link>
          </Button>
        </div>
    </>
  );
}
