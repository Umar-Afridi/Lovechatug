'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { UserProfile, RoomMember } from '@/lib/types';
import { Users } from 'lucide-react';
import { VerifiedBadge } from '../ui/verified-badge';
import { OfficialBadge } from '../ui/official-badge';
import { cn } from '@/lib/utils';

interface RoomMembersSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  members: RoomMember[];
  memberProfiles: Map<string, UserProfile>;
  onViewProfile: (user: UserProfile) => void;
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
};

export function RoomMembersSheet({
  isOpen,
  onOpenChange,
  members,
  memberProfiles,
  onViewProfile,
}: RoomMembersSheetProps) {

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5"/>
              Room Members ({members.length})
          </SheetTitle>
          <SheetDescription>
            See who is currently in the room.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 py-4">
                {members.map(member => {
                    const profile = memberProfiles.get(member.userId);
                    if (!profile) return null; // or a skeleton loader

                    return (
                        <div key={member.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={profile.photoURL}/>
                                    <AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden">
                                    <div className="flex items-center gap-2">
                                        <p className={cn(
                                            "font-semibold truncate",
                                            profile.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                                        )}>
                                            {profile.displayName}
                                        </p>
                                        {profile.verifiedBadge?.showBadge && <VerifiedBadge color={profile.verifiedBadge.badgeColor} />}
                                        {profile.officialBadge?.isOfficial && <OfficialBadge size="icon" className="h-4 w-4" color={profile.officialBadge.badgeColor}/>}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
                                </div>
                            </div>
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  onViewProfile(profile);
                                  onOpenChange(false); // Close members sheet
                                }}
                            >
                                View
                            </Button>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
