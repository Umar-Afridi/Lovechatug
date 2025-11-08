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
import { useIsMobile } from '@/hooks/use-mobile';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getDatabase, ref, onValue, off, onDisconnect, serverTimestamp as rtdbServerTimestamp, set } from 'firebase/database';


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
    const unsubscribe = onSnapshot(userDocRef, 
      (docSnap) => {
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
      }, 
      (error) => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, firestore, authLoading]);

  return { profile, loading };
}

// Custom hook for presence management
function usePresence() {
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (!user || !firestore) return;

    // Get a reference to the Realtime Database
    const db = getDatabase();
    // Create a reference for this user's presence status in the Realtime Database.
    const userStatusDatabaseRef = ref(db, '/status/' + user.uid);
    // Create a reference to this user's document in Firestore.
    const userStatusFirestoreRef = doc(firestore, 'users', user.uid);

    // Get a reference to the special '.info/connected' path in Realtime Database.
    // This path is true when the client is connected and false when it's not.
    const connectedRef = ref(db, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // The client is connected.
        // 1. Set the Realtime Database presence status.
        const presenceData = { isOnline: true, lastSeen: rtdbServerTimestamp() };
        set(userStatusDatabaseRef, presenceData);

        // 2. When the client disconnects, update the Realtime Database.
        // THIS IS THE CRITICAL PART: `onDisconnect` is a Realtime Database feature.
        onDisconnect(userStatusDatabaseRef).set({ isOnline: false, lastSeen: rtdbServerTimestamp() });

        // 3. Also update the Firestore document to show the user is online.
        const firestoreUpdateData = { isOnline: true };
        updateDoc(userStatusFirestoreRef, firestoreUpdateData).catch(err => {
          if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: userStatusFirestoreRef.path, operation: 'update', requestResourceData: firestoreUpdateData });
            errorEmitter.emit('permission-error', permissionError);
          }
        });
      }
    }, (error) => {
      console.error("Error with presence listener:", error);
    });

    return () => {
       // On unmount/cleanup, explicitly set offline in both databases.
      if (typeof unsubscribe === 'function') {
        off(connectedRef, 'value', unsubscribe);
      }
       set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });
       updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(err => {
            // This might fail if the user is already offline, which is fine.
       });
    };
  }, [user, firestore]);
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
  usePresence(); // Initialize presence management
  const router = useRouter();
  const isMobile = useIsMobile();
  const isChatDetailPage = pathname.startsWith('/chat/') && pathname.split('/').length > 2;
  const [requestCount, setRequestCount] = useState(0);
  const { toast } = useToast();
  
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
    if (!authLoading && !user && pathname !== '/') {
      router.push('/');
    }
  }, [authLoading, user, router, pathname]);

  const handleSignOut = async () => {
    if (auth && user && firestore) {
      const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
      const db = getDatabase();
      const userStatusDatabaseRef = ref(db, '/status/' + user.uid);

      // Set offline in both databases before signing out
      await updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() });
      await set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });

      await auth.signOut();
      router.push('/');
    }
  };

  const loading = authLoading || profileLoading;

  if (loading || (!user && pathname !== '/')) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return <>{children}</>;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const showSidebar = !isMobile || !isChatDetailPage;

  return (
    <div className="flex h-screen bg-background">
      <SidebarProvider>
        {showSidebar && (
          <Sidebar side="left" collapsible="icon" className="group hidden md:flex">
              <SidebarHeader>
                  <Link href="/profile" className="h-12 w-full justify-start gap-2 px-2 flex items-center">
                      <Avatar className="h-8 w-8">
                      <AvatarImage
                          src={profile?.photoURL ?? undefined}
                          alt={profile?.displayName ?? 'user-avatar'}
                      />
                      <AvatarFallback>
                          {getInitials(profile?.displayName)}
                      </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-sm font-medium">
                          {profile?.displayName ?? 'User'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                          {profile?.email ?? 'No email'}
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
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Logout" onClick={handleSignOut}>
                            <LogOut />
                            <span>Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
              </SidebarMenu>
              </SidebarFooter>
          </Sidebar>
        )}
        <main className={cn(
          "flex-1 transition-all duration-300 w-full",
          isMobile && isChatDetailPage ? "block" : "md:block",
          isMobile && !isChatDetailPage ? "block" : "md:block",
          !isMobile ? "flex" : ""
        )}>
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}

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

    
