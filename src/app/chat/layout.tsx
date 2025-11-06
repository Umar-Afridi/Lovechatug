'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Users,
  Phone,
  Settings,
  UserPlus,
  LogOut,
  GalleryHorizontal,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarProvider,
  SidebarInset,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { useAuth, useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import { getRedirectResult, User } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { collection, onSnapshot, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';


const menuItems = [
  {
    href: '/chat',
    icon: MessageSquare,
    label: 'Chats',
  },
  {
     href: '/chat/groups',
     icon: Users,
     label: 'Groups',
  },
  {
     href: '/chat/friends',
     icon: UserPlus,
     label: 'Friend Requests',
     id: 'friend-requests'
  },
  {
     href: '/chat/calls',
     icon: Phone,
     label: 'Call History',
  },
];

// Custom hook to get user profile data in real-time
function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user || !firestore) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Fallback to auth data if firestore doc doesn't exist
        setProfile({
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          username: user.email?.split('@')[0] || `user-${Date.now()}`
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore, authLoading]);

  return { profile, loading };
}


export default function ChatAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading: authLoading } = useUser();
  const { profile, loading: profileLoading } = useUserProfile();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isChatDetailPage = pathname.startsWith('/chat/') && pathname.split('/').length > 2;
  const [requestCount, setRequestCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!auth || !firestore) return;

    const handleRedirectResult = async (user: User) => {
      const userDocRef = doc(firestore, 'users', user.uid);
      try {
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            username: user.email?.split('@')[0] ?? `user-${Date.now()}`,
            photoURL: user.photoURL,
            friends: [],
            bio: '',
          };

          await setDoc(userDocRef, userData).catch((serverError) => {
              const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'create',
                requestResourceData: userData,
              });
              errorEmitter.emit('permission-error', permissionError);
              throw new Error('Could not save user profile. Insufficient permissions.');
            });
        }
        router.push('/chat');
      } catch (error: any) {
         if (!(error instanceof FirestorePermissionError)) {
            toast({
              variant: "destructive",
              title: "Sign-In Error",
              description: "Could not process user profile after sign-in.",
            });
         }
      }
    };

    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          handleRedirectResult(result.user);
        }
      })
      .catch((error) => {
        console.error('Google sign-in redirect error:', error);
        toast({
          variant: "destructive",
          title: "Sign-In Failed",
          description: "Could not complete sign-in with Google. Please try again.",
        });
      });
  }, [auth, firestore, router, toast]);
  
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const requestsRef = collection(firestore, 'friendRequests');
    const q = query(requestsRef, where('receiverId', '==', user.uid), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setRequestCount(snapshot.size);
      },
      (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: requestsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Error fetching friend request count:", serverError);
      }
    );

    return () => unsubscribe();
  }, [firestore, user]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  const loading = authLoading || profileLoading;

  if (loading || !user || !profile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  // On mobile, if we are on a chat detail page, we don't want to show the sidebar.
  // The main layout for mobile will be handled by the pages themselves.
  if (isMobile && (isChatDetailPage || pathname === '/profile')) {
      return (
        <main>{children}</main>
      )
  }

  return (
    <div className="flex">
        <SidebarProvider>
            <Sidebar side="left" collapsible="icon" className="group">
                <SidebarHeader>
                    <Link href="/profile" className="h-12 w-full justify-start gap-2 px-2 flex items-center">
                        <Avatar className="h-8 w-8">
                        <AvatarImage
                            src={profile.photoURL ?? undefined}
                            alt={profile.displayName ?? 'user-avatar'}
                        />
                        <AvatarFallback>
                            {getInitials(profile.displayName)}
                        </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                        <span className="truncate text-sm font-medium">
                            {profile.displayName ?? 'User'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {profile.email ?? 'No email'}
                        </span>
                        </div>
                    </Link>
                </SidebarHeader>
                <SidebarContent>
                <SidebarMenu>
                    {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <Link href={item.href}>
                        <SidebarMenuButton
                            isActive={pathname.startsWith(item.href) && (item.href === '/chat' ? pathname.split('/').length <= 2 : true)}
                            tooltip={item.label}
                        >
                            <item.icon />
                            <span>{item.label}</span>
                             {item.id === 'friend-requests' && requestCount > 0 && (
                                <SidebarMenuBadge>{requestCount}</SidebarMenuBadge>
                            )}
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                      <Link href="/profile" className="w-full">
                        <SidebarMenuButton tooltip="Settings">
                            <Settings />
                            <span>Settings</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
            <main className="flex-1">{children}</main>
        </SidebarProvider>
    </div>
  );
}
