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
} from '@/components/ui/sidebar';
import { useAuth } from '@/firebase/provider';
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
import { useEffect } from 'react';
import { getRedirectResult } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-mobile';


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
  },
  {
     href: '/chat/calls',
     icon: Phone,
     label: 'Call History',
  },
];

export default function ChatAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const { user, loading } = useUser();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isChatDetailPage = pathname.startsWith('/chat/') && pathname.split('/').length > 2;

  useEffect(() => {
    if (auth) {
      getRedirectResult(auth)
        .then((result) => {
          if (result) {
            router.push('/chat');
          }
        })
        .catch((error) => {
          console.error('Google sign-in redirect error:', error);
        });
    }
  }, [auth, router]);

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-2 px-2"
                    >
                        <Avatar className="h-8 w-8">
                        <AvatarImage
                            src={user?.photoURL ?? undefined}
                            alt={user?.displayName ?? 'user-avatar'}
                        />
                        <AvatarFallback>
                            {getInitials(user?.displayName)}
                        </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                        <span className="truncate text-sm font-medium">
                            {user?.displayName ?? 'User'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {user?.email ?? 'No email'}
                        </span>
                        </div>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Billing</DropdownMenuItem>
                    <DropdownMenuItem>Team</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Settings">
                        <Settings />
                        <span>Settings</span>
                    </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
            <main className="flex-1">{children}</main>
        </SidebarProvider>
    </div>
  );
}
