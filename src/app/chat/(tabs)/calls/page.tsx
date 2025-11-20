'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Phone,
  Video,
  MoreVertical,
  Trash2,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  writeBatch,
  orderBy,
} from 'firebase/firestore';
import type { UserProfile, Call } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { OfficialBadge } from '@/components/ui/official-badge';
import { applyNameColor } from '@/lib/utils';

interface CallWithUser extends Call {
  otherUser?: UserProfile;
}

const CallItem = ({
  call,
  otherUser,
}: {
  call: Call;
  otherUser: UserProfile;
}) => {
  if (!otherUser) return null;

  const getInitials = (name: string) =>
    name ? name.split(' ').map((n) => n[0]).join('') : 'U';

  const CallStatusIcon = ({
    direction,
    status,
  }: {
    direction: string;
    status: string;
  }) => {
    const className =
      status === 'missed' || status === 'declined'
        ? 'text-destructive'
        : 'text-muted-foreground';
    if (direction === 'incoming') {
      return <PhoneIncoming className={className + ' h-4 w-4'} />;
    }
    return <PhoneOutgoing className={className + ' h-4 w-4'} />;
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={otherUser?.photoURL} />
            <AvatarFallback>
              {getInitials(otherUser?.displayName)}
            </AvatarFallback>
          </Avatar>
          {otherUser?.officialBadge?.isOfficial && (
            <div className="absolute bottom-0 right-0">
              <OfficialBadge
                color={otherUser.officialBadge.badgeColor}
                size="icon"
                className="h-4 w-4"
                isOwner={otherUser.canManageOfficials}
              />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'font-semibold',
                call.status === 'missed' || call.status === 'declined'
                  ? 'text-destructive'
                  : ''
              )}
            >
              {applyNameColor(otherUser?.displayName, otherUser?.nameColor)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CallStatusIcon direction={call.direction} status={call.status} />
            {formatTimestamp(call.timestamp)}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="icon">
        {call.type === 'video' ? (
          <Video className="h-5 w-5 text-primary" />
        ) : (
          <Phone className="h-5 w-5 text-primary" />
        )}
      </Button>
    </div>
  );
};

export default function CallsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [calls, setCalls] = useState<CallWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const { toast } = useToast();
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(
    new Map()
  );

  const handleClearAll = async () => {
    if (!firestore || !user || calls.length === 0) return;

    const batch = writeBatch(firestore);
    calls.forEach((call) => {
      if (call.id) {
        const callRef = doc(firestore, 'calls', call.id);
        batch.delete(callRef);
      }
    });

    try {
      await batch.commit();
      toast({
        title: 'Call History Cleared',
        description: 'All your call records have been deleted.',
      });
    } catch (error) {
      console.error('Error clearing call history: ', error);
      toast({
        title: 'Error',
        description: 'Could not clear call history.',
        variant: 'destructive',
      });
    } finally {
      setClearAllDialogOpen(false);
    }
  };

  useEffect(() => {
    if (!user || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const callsRef = collection(firestore, 'calls');

    const q = query(
      callsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const callDocs = querySnapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Call)
        );

        const otherUserIds = [
          ...new Set(
            callDocs.flatMap((call) =>
              call.participants.filter((pId) => pId !== user.uid)
            )
          ),
        ];

        // Fetch any user profiles that we don't have cached
        const newIdsToFetch = otherUserIds.filter(
          (id) => !userProfiles.has(id)
        );
        if (newIdsToFetch.length > 0) {
          const usersQuery = query(
            collection(firestore, 'users'),
            where('uid', 'in', newIdsToFetch)
          );
          getDocs(usersQuery).then((usersSnapshot) => {
            const newProfiles = new Map(userProfiles);
            usersSnapshot.forEach((doc) =>
              newProfiles.set(doc.id, doc.data() as UserProfile)
            );
            setUserProfiles(newProfiles);
          });
        }

        const populatedCalls = callDocs
          .map((call) => {
            const otherUserId =
              call.participants.find((pId) => pId !== user.uid) || '';
            return {
              ...call,
              otherUser: userProfiles.get(otherUserId),
              direction: call.callerId === user.uid ? 'outgoing' : 'incoming',
            };
          })
          .filter((call) => call.otherUser) as CallWithUser[];

        setCalls(populatedCalls);
        setLoading(false);
      },
      (error) => {
        console.error(`Error fetching calls for user ${user.uid}:`, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, firestore, userProfiles]);

  return (
    <div className="flex h-full flex-[0_0_100%] flex-col bg-background">
      <AlertDialog
        open={isClearAllDialogOpen}
        onOpenChange={setClearAllDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your call history. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        {/* Content */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <p>Loading call history...</p>
            </div>
          ) : calls.length > 0 ? (
            <div className="divide-y">
              {calls.map((call) => (
                <CallItem
                  key={call.id}
                  call={call}
                  otherUser={call.otherUser!}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Phone
                className="h-16 w-16 text-muted-foreground/50 mb-4"
              />
              <h2 className="text-xl font-semibold">No Call History</h2>
              <p className="text-muted-foreground mt-2">
                You haven't made or received any calls yet.
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
  );
}
