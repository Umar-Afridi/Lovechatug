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
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24 border-2 border-primary">
              <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
              <AvatarFallback className="text-3xl">
                {getInitials(userProfile.displayName)}
              </AvatarFallback>
            </Avatar>
          </div>
          <SheetTitle className="text-2xl font-bold">{userProfile.displayName}</SheetTitle>
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
