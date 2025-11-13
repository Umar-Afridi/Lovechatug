'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserProfile } from '@/lib/types';
import { Loader2, FileUp } from 'lucide-react';
import { useState } from 'react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const verificationSchema = z.object({
  document: z
    .any()
    .refine((files) => files?.length == 1, 'Document is required.')
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      '.jpg, .jpeg, .png and .webp files are accepted.'
    ),
});

type VerificationFormValues = z.infer<typeof verificationSchema>;

interface VerificationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { document: FileList }) => void;
  userProfile: UserProfile | null;
  isSubmitting: boolean;
}

export function VerificationDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  userProfile,
  isSubmitting,
}: VerificationDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
  });
  
  const watchedFile = watch("document");
  const fileName = watchedFile?.[0]?.name;


  const handleFormSubmit: SubmitHandler<VerificationFormValues> = (data) => {
    onSubmit(data);
  };

  if (!userProfile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verified Badge Application</DialogTitle>
          <DialogDescription>
            Submit a clear photo of your National ID, Passport, or Driver's License. Your details must match your profile.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={userProfile.displayName} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={`@${userProfile.username}`} readOnly disabled />
          </div>
           <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={userProfile.email} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document">Government-issued ID</Label>
            <div className="relative">
                <Input id="document" type="file" className="hidden" {...register('document')} />
                <label htmlFor="document" className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FileUp className="w-8 h-8 mb-2" />
                        {fileName ? (
                             <span className="text-sm font-medium text-foreground">{fileName}</span>
                        ) : (
                            <span className="text-sm text-center">Click to upload document</span>
                        )}
                       
                    </div>
                </label>
            </div>
            {errors.document && (
              // @ts-ignore
              <p className="text-sm text-destructive mt-1">{errors.document.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
