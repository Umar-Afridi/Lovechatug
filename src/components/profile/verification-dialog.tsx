'use client';

import { useState, useRef, useEffect } from 'react';
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
import type { VerificationInput } from '@/ai/flows/send-verification-email';

interface VerificationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: VerificationInput) => Promise<void>;
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
  const [activeEmail, setActiveEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.email) {
      setActiveEmail(userProfile.email);
    }
  }, [userProfile]);


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
    if (!activeEmail) {
      toast({ title: 'Email Required', description: 'Please enter your active email address.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onloadend = async () => {
        const base64Document = reader.result as string;
        const submissionData: VerificationInput = {
            fullName: userProfile.displayName,
            username: userProfile.username,
            email: activeEmail,
            document: base64Document,
        };
        await onSubmit(submissionData);
        setIsSubmitting(false);
        onOpenChange(false); // Close dialog on submit
    };
     reader.onerror = () => {
        setIsSubmitting(false);
        toast({ title: 'File Read Error', description: 'Could not read the selected file.', variant: 'destructive' });
    };
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
            Provide your details and a government-issued ID to verify your identity.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={userProfile.displayName} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={`@${userProfile.username}`} readOnly disabled />
          </div>
           <div className="space-y-2">
            <Label htmlFor="activeEmail">Your Active Email</Label>
            <Input 
              id="activeEmail" 
              type="email"
              placeholder="Your best contact email"
              value={activeEmail} 
              onChange={(e) => setActiveEmail(e.target.value)} 
              required
            />
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
             <p className="text-xs text-muted-foreground pt-1">Max file size: 5MB. Accepts PNG, JPG, PDF.</p>
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
