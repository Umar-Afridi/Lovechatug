'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileUp } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface VerificationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File) => Promise<void>;
  userProfile: UserProfile;
}

export function VerificationDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  userProfile,
}: VerificationDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File Too Large',
          description: 'Please select a file smaller than 5MB.',
          variant: 'destructive'
        });
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({ title: 'No File Selected', description: 'Please select a document to upload.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    await onSubmit(selectedFile);
    setIsSubmitting(false);
    onOpenChange(false); // Close dialog on submit
  };

  // Reset state when dialog is closed
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedFile(null);
      setFileName('');
      setIsSubmitting(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verification Application</DialogTitle>
          <DialogDescription>
            Please provide a government-issued ID to verify your identity. Your
            information will be handled securely.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={userProfile.displayName} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={`@${userProfile.username}`} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document">Government-issued ID</Label>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleChooseFileClick} type="button">
                    <FileUp className="mr-2 h-4 w-4" />
                    Choose File
                </Button>
                 <p className="text-sm text-muted-foreground truncate">{fileName || 'No file chosen'}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png, image/jpeg, application/pdf"
              onChange={handleFileChange}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!selectedFile || isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
