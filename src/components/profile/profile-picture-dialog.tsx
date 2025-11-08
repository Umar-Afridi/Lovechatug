'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Trash2, Edit, User as UserIcon } from 'lucide-react';

interface ProfilePictureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhotoURL: string | null;
  onRemove: () => void;
  onChange: () => void;
}

export function ProfilePictureDialog({
  isOpen,
  onOpenChange,
  currentPhotoURL,
  onRemove,
  onChange,
}: ProfilePictureDialogProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Picture</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center items-center my-8">
            <Avatar className="h-48 w-48 border-4 border-primary/20">
                <AvatarImage src={currentPhotoURL ?? undefined} alt="Profile" />
                <AvatarFallback className="text-6xl bg-muted">
                    <UserIcon className="h-24 w-24 text-muted-foreground" />
                </AvatarFallback>
            </Avatar>
        </div>
        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={onChange}>
            <Edit className="mr-2 h-4 w-4" />
            Change Photo
          </Button>
          <Button variant="destructive" onClick={onRemove} disabled={!currentPhotoURL}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
