'use client';

import { useState } from 'react';
import { useAuth } from '@/firebase/provider';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function ForgotPasswordDialog() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handlePasswordReset = async () => {
    if (!auth || !email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter your email address.',
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: `An email has been sent to ${email} with instructions to reset your password.`,
      });
      setIsOpen(false); // Close dialog on success
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      let description = 'Could not send password reset email. Please try again.';
      if (error.code === 'auth/user-not-found') {
        description = 'No user found with this email address.';
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: description,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="text-sm font-medium text-primary hover:underline underline-offset-4">
          Forgot Password?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forgot Password</DialogTitle>
          <DialogDescription>
            Enter your email address and we will send you a link to reset your
            password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email Address</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handlePasswordReset}>
            Send Reset Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
