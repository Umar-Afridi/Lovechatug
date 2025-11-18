'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase/auth/use-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Shield, Trash2, CheckCheck, Palette, Clock, UserCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { getDatabase, ref, set, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';


export default function ProfilePage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const nameColorClass = useMemo(() => {
    if (!userProfile?.nameColor || userProfile.nameColor === 'default') return '';
    if (userProfile.nameColor === 'gradient') return "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate";
    
    const colorClasses: Record<string, string> = {
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };
    return cn('font-bold', colorClasses[userProfile.nameColor]);
  }, [userProfile?.nameColor]);

  useEffect(() => {
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
          }
      });
      return () => unsubscribe();
    }
  }, [user, firestore]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);

  if (loading || !user || !userProfile) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
  };
  
 const handleDeleteAccount = async () => {
    if (!user || !firestore || !auth) {
      toast({ title: "Error", description: "User session is not valid.", variant: "destructive" });
      return;
    }
    
    const userDocRef = doc(firestore, 'users', user.uid);
    
    try {
      await updateDoc(userDocRef, {
        isDisabled: true,
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
      
      await auth.signOut();

      toast({ title: "Account Deactivated", description: "Your account has been deactivated." });
      router.push('/');

    } catch (error: any) {
      console.error("Error deactivating account:", error);
      toast({ title: "Error", description: "Could not deactivate account.", variant: "destructive"});
    } finally {
        setDeleteDialogOpen(false);
    }
  };


  const handleSignOut = async () => {
    if (auth && user && firestore) {
      const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
      const db = getDatabase();
      const userStatusDatabaseRef = ref(db, '/status/' + user.uid);

      await updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() });
      await set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });

      await auth.signOut();
      router.push('/');
    }
  };

  return (
    <>
        <DeleteAccountDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDeleteAccount}
        />
        <div className="flex min-h-screen flex-col bg-background">
            <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold">Me</h1>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <div className="mx-auto max-w-xl space-y-8">
                    <Link href="/profile/edit" className="block">
                        <div className="flex items-center gap-4 rounded-lg p-4 bg-muted/50 hover:bg-muted transition-colors">
                            <div className="relative">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={userProfile.photoURL ?? undefined} alt={userProfile.displayName} />
                                    <AvatarFallback className="text-3xl">
                                        {getInitials(userProfile.displayName)}
                                    </AvatarFallback>
                                </Avatar>
                                {userProfile.verifiedBadge?.showBadge && (
                                    <div className="absolute bottom-0 right-0">
                                        <VerifiedBadge color={userProfile.verifiedBadge.badgeColor} className="h-6 w-6"/>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h2 className={cn("text-2xl font-bold", nameColorClass)}>{userProfile.displayName}</h2>
                                <p className="text-muted-foreground">@{userProfile.username}</p>
                                {userProfile.officialBadge?.isOfficial && (
                                   <div className="mt-2">
                                        <OfficialBadge color={userProfile.officialBadge.badgeColor} isOwner={userProfile.canManageOfficials} />
                                   </div>
                                )}
                            </div>
                        </div>
                    </Link>
                    
                    <div className="space-y-2 pt-4">
                         {userProfile.officialBadge?.isOfficial && (
                             <Button variant="outline" className="w-full justify-start text-base py-6" asChild>
                                <Link href="/admin/super">
                                    <UserCog className="mr-4 h-5 w-5 text-primary" />
                                    Super Admin Panel
                                </Link>
                            </Button>
                         )}
                        <Button className="w-full justify-start text-base py-6" variant="outline" asChild>
                            <Link href="/settings">
                                <Shield className="mr-4 h-5 w-5" />
                                Privacy & Security
                            </Link>
                        </Button>
                        <Button className="w-full justify-start text-base py-6" variant="outline" onClick={() => setDeleteDialogOpen(true)} >
                            <Trash2 className="mr-4 h-5 w-5 text-destructive" />
                            <span className="text-destructive">Delete Account</span>
                        </Button>
                        <Button className="w-full justify-start text-base py-6" variant="outline" onClick={handleSignOut}>
                            <LogOut className="mr-4 h-5 w-5" />
                            Logout
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    </>
  );
}
