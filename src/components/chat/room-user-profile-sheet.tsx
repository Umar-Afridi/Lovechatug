
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { UserProfile, FriendRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '../ui/verified-badge';
import { OfficialBadge } from '../ui/official-badge';
import { UserPlus } from 'lucide-react';
import { useMemo } from 'react';

interface RoomUserProfileSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userToView: UserProfile | null;
  currentUser: UserProfile | null;
  friendRequests: FriendRequest[];
  onSendRequest: (userId: string) => void;
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
};

export function RoomUserProfileSheet({
  isOpen,
  onOpenChange,
  userToView,
  currentUser,
  friendRequests,
  onSendRequest,
}: RoomUserProfileSheetProps) {

  const friendStatus = useMemo(() => {
    if (!currentUser || !userToView || currentUser.uid === userToView.uid) return 'self';
    
    if (currentUser.friends?.includes(userToView.uid)) {
      return 'friends';
    }
    
    const sentRequest = friendRequests.find(req => req.senderId === currentUser.uid && req.receiverId === userToView.uid);
    if (sentRequest) {
      return 'sent';
    }

    const receivedRequest = friendRequests.find(req => req.senderId === userToView.uid && req.receiverId === currentUser.uid);
    if (receivedRequest) {
      return 'received';
    }

    return 'none';
  }, [currentUser, userToView, friendRequests]);

  if (!userToView) {
    return null;
  }

  const canSendRequest = friendStatus === 'none';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <div className='flex-1 overflow-y-auto'>
            <SheetHeader className="text-center mb-6">
            <div className="flex justify-center mb-4 relative">
                <Avatar className="h-24 w-24 border-2 border-primary">
                <AvatarImage src={userToView.photoURL} alt={userToView.displayName} />
                <AvatarFallback className="text-3xl">
                    {getInitials(userToView.displayName)}
                </AvatarFallback>
                </Avatar>
            </div>
            
            {userToView.officialBadge?.isOfficial && (
                    <div className="flex justify-center mb-2">
                        <OfficialBadge color={userToView.officialBadge.badgeColor} />
                    </div>
                )}
            <SheetTitle className={cn(
                "text-2xl font-bold flex items-center justify-center gap-2",
                userToView.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                )}>
                {userToView.displayName}
                {userToView.verifiedBadge?.showBadge && (
                    <VerifiedBadge color={userToView.verifiedBadge.badgeColor} className="h-6 w-6"/>
                )}
                </SheetTitle>
            <SheetDescription className="text-muted-foreground">@{userToView.username}</SheetDescription>
            </SheetHeader>
            
            <Separator />

            <div className="py-6 space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Bio</h3>
                <p className="text-base text-foreground">
                    {userToView.bio || 'This user has not set a bio yet.'}
                </p>
            </div>

            <Separator />
        </div>
        
        <SheetFooter className="mt-4">
            {canSendRequest && (
                 <Button className="w-full" onClick={() => onSendRequest(userToView.uid)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Friend
                 </Button>
            )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
