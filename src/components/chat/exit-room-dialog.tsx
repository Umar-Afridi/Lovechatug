'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowDownToLine } from 'lucide-react';

interface ExitRoomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
  onMinimize: () => void;
}

export function ExitRoomDialog({ isOpen, onOpenChange, onLeave, onMinimize }: ExitRoomDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs p-0 gap-0">
        <div className="flex flex-col">
            <Button
                variant="ghost"
                className="w-full justify-start text-base rounded-t-lg rounded-b-none py-6 text-destructive hover:text-destructive"
                onClick={onLeave}
            >
                <LogOut className="mr-4 h-5 w-5" />
                Leave
            </Button>
            <Button
                variant="ghost"
                className="w-full justify-start text-base rounded-b-lg rounded-t-none py-6"
                onClick={onMinimize}
            >
                <ArrowDownToLine className="mr-4 h-5 w-5" />
                Minimize
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
