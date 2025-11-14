'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, arrayRemove, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Shield, Lock, ArrowLeft, UserX, UserCog, HelpCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';


function BlockedUsersList() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const userDocRef = useMemo(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    useEffect(() => {
        if (!userDocRef || !firestore) return;

        const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const blockedIds = userData.blockedUsers || [];
                
                if (blockedIds.length > 0) {
                     try {
                        const usersRef = collection(firestore, 'users');
                        // Firestore 'in' query is limited to 30 items. Chunk if necessary.
                        const q = query(usersRef, where('uid', 'in', blockedIds));
                        const querySnapshot = await getDocs(q);
                        const users = querySnapshot.docs.map(doc => doc.data() as UserProfile);
                        setBlockedUsers(users);
                    } catch (error) {
                        const permissionError = new FirestorePermissionError({
                            path: 'users',
                            operation: 'list',
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    }
                } else {
                    setBlockedUsers([]);
                }
            }
             setLoading(false);
        });

        return () => unsubscribe();

    }, [userDocRef, firestore]);


    const handleUnblock = async (blockedUserId: string) => {
        if (!userDocRef) return;
        
        const payload = { blockedUsers: arrayRemove(blockedUserId) };
        try {
            await updateDoc(userDocRef, payload);
            toast({ title: "User Unblocked", description: "You can now chat with this user again."});
        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { blockedUsers: arrayRemove(blockedUserId) }
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

    if (loading) {
        return <p className="text-muted-foreground text-sm p-4">Loading block list...</p>;
    }

    if (blockedUsers.length === 0) {
        return <p className="text-muted-foreground text-sm p-4">You haven't blocked any users.</p>;
    }

    return (
        <ScrollArea className="max-h-96">
            <div className="space-y-2 p-1">
                {blockedUsers.map(blockedUser => (
                    <div key={blockedUser.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={blockedUser.photoURL} />
                                <AvatarFallback>{getInitials(blockedUser.displayName)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{blockedUser.displayName}</p>
                                <p className="text-xs text-muted-foreground">@{blockedUser.username}</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleUnblock(blockedUser.uid)}>Unblock</Button>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}


export default function SettingsPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
    const [findingHelp, setFindingHelp] = useState(false);

    useEffect(() => {
        if (!user || !firestore) return;
        const userDocRef = doc(firestore, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setCurrentUserProfile(docSnap.data() as UserProfile);
            }
        });
        return () => unsubscribe();
    }, [user, firestore]);

    const handleAppLockClick = () => {
        toast({
            title: "Coming Soon!",
            description: "App Lock functionality will be available in a future update."
        });
    };
    
    const handleHelpCenterClick = async () => {
        if (!firestore) return;
        setFindingHelp(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(
                usersRef,
                where('officialBadge.isOfficial', '==', true),
                where('isOnline', '==', true),
                limit(1)
            );

            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                toast({
                    variant: 'destructive',
                    title: 'No Support Available',
                    description: 'No support agents are currently online. Please try again later.',
                });
            } else {
                const agent = querySnapshot.docs[0].data() as UserProfile;
                router.push(`/chat/${agent.uid}`);
            }
        } catch (error) {
            console.error("Error finding help agent:", error);
            const permissionError = new FirestorePermissionError({
                path: 'users',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not connect to the help center. Please try again.',
            });
        } finally {
            setFindingHelp(false);
        }
    };
    
    const baseButtonClassName = "w-full text-base py-8 justify-center rounded-lg border-b-4 active:translate-y-1 active:border-b-0 transition-all duration-150 ease-in-out";

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5"/>
                    <span>Privacy & Security</span>
                </h1>
            </header>

            <main className="flex-1 p-4 md:p-6">
                <div className="mx-auto max-w-2xl space-y-4">
                     {currentUserProfile?.officialBadge?.isOfficial && (
                         <Button variant="outline" className={cn(baseButtonClassName, "border-primary/50 dark:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10")} asChild>
                            <Link href="/admin/super">
                                <UserCog className="mr-4 h-6 w-6 text-primary" />
                                <span className="text-primary dark:text-primary-foreground">Super Admin Panel</span>
                            </Link>
                        </Button>
                     )}
                     <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-base font-medium px-2">
                                <div className="flex items-center gap-3">
                                    <UserX className="h-5 w-5" />
                                    <span>Block List</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <BlockedUsersList />
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="item-2">
                            <AccordionTrigger className="text-base font-medium px-2" onClick={handleAppLockClick}>
                               <div className="flex items-center gap-3">
                                    <Lock className="h-5 w-5" />
                                    <span>App Lock</span>
                                </div>
                            </AccordionTrigger>
                            {/* Content could be added here if it becomes a collapsible section */}
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger 
                                className="text-base font-medium px-2" 
                                onClick={handleHelpCenterClick}
                                disabled={findingHelp}
                            >
                               <div className="flex items-center gap-3">
                                    <HelpCircle className="h-5 w-5" />
                                    <span>{findingHelp ? "Finding help..." : "Help Center"}</span>
                                </div>
                            </AccordionTrigger>
                        </AccordionItem>
                    </Accordion>
                </div>
            </main>
        </div>
    );
}
