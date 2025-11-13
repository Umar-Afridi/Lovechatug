'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '../ui/verified-badge';
import { OfficialBadge } from '../ui/official-badge';

interface ContactProfileSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userProfile: UserProfile | null;
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
};

export function ContactProfileSheet({
  isOpen,
  onOpenChange,
  userProfile,
}: ContactProfileSheetProps) {

  if (!userProfile) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="text-center mb-6">
          <div className="flex justify-center mb-4 relative">
            <Avatar className="h-24 w-24 border-2 border-primary">
              <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
              <AvatarFallback className="text-3xl">
                {getInitials(userProfile.displayName)}
              </AvatarFallback>
            </Avatar>
          </div>
          
           <div className="flex items-center justify-center gap-2 mb-2">
            {userProfile.officialBadge?.isOfficial && (
                <OfficialBadge color={userProfile.officialBadge.badgeColor} className="h-7 w-7"/>
            )}
            {userProfile.verifiedBadge?.showBadge && (
                <VerifiedBadge color={userProfile.verifiedBadge.badgeColor} className="h-7 w-7"/>
            )}
          </div>
          
          <SheetTitle className={cn(
            "text-2xl font-bold",
            userProfile.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
            )}>
            {userProfile.displayName}
            </SheetTitle>
          <SheetDescription className="text-muted-foreground">@{userProfile.username}</SheetDescription>
        </SheetHeader>
        
        <Separator />

        <div className="py-6 space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Bio</h3>
            <p className="text-base text-foreground">
                {userProfile.bio || 'This user has not set a bio yet.'}
            </p>
        </div>

        <Separator />
        
      </SheetContent>
    </Sheet>
  );
}
