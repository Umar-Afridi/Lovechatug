'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '../ui/button';

interface DeleteMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: 'forMe' | 'forEveryone') => void;
}

export function DeleteMessageDialog({ isOpen, onOpenChange, onConfirm }: DeleteMessageDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Message?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose how you want to delete this message.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
           <Button 
                variant="destructive"
                onClick={() => onConfirm('forEveryone')}
            >
                Delete for everyone
            </Button>
            <Button 
                 variant="outline"
                onClick={() => onConfirm('forMe')}
            >
                Delete for me
            </Button>
            <AlertDialogCancel asChild>
                 <Button variant="ghost">Cancel</Button>
            </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
