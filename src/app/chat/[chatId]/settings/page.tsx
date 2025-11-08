'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { ArrowLeft, User, Trash2, UserX, ShieldX, Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ContactProfileSheet } from '@/components/chat/contact-profile-sheet';
import { ClearChatDialog } from '@/components/chat/clear-chat-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';


const backgroundOptions = [
  { name: 'Default', value: 'default', color: 'hsl(var(--background))' },
  { name: 'Rose', value: 'rose', color: 'hsl(var(--chat-bg-rose))' },
  { name: 'Violet', value: 'violet', color: 'hsl(var(--chat-bg-violet))' },
  { name: 'Green', value: 'green', color: 'hsl(var(--chat-bg-green))' },
  { name: 'Yellow', value: 'yellow', color: 'hsl(var(--chat-bg-yellow))' },
  { name: 'Blue', value: 'blue', color: 'hsl(var(--chat-bg-blue))' },
];


export default function ChatSettingsPage({
  params,
}: {
  params: { chatId: string };
}) {
  const { chatId: otherUserId } = React.use(params);
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [chatData, setChatData] = useState<any>(null);
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);
  const [isClearChatDialogOpen, setClearChatDialogOpen] = useState(false);
  const [isBackgroundSheetOpen, setBackgroundSheetOpen] = useState(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Swipe to go back logic
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.targetTouches[0].clientX;
      touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
      // Check if it's a swipe from left to right and it's significant
      if (touchStartX.current < 50 && touchEndX.current > touchStartX.current + 100) {
        router.back();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [router]);


  useEffect(() => {
    if (!firestore || !otherUserId || !user) return;
    
    // Fetch other user's profile
    const userDocRef = doc(firestore, 'users', otherUserId);
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        setOtherUser(docSnap.data() as UserProfile);
      } else {
        toast({
          title: 'Error',
          description: 'User not found.',
          variant: 'destructive',
        });
        router.back();
      }
    }).catch(error => {
      if (error.code === 'permission-denied') {
         toast({
          title: 'Access Denied',
          description: "You don't have permission to view this user's details.",
          variant: 'destructive',
        });
        router.back();
      }
    });
    
    // Fetch chat data
    const chatId = [user.uid, otherUserId].sort().join('_');
    const chatDocRef = doc(firestore, 'chats', chatId);
    getDoc(chatDocRef).then((docSnap) => {
        if(docSnap.exists()) {
            setChatData(docSnap.data());
        }
    });

  }, [firestore, otherUserId, user, router, toast]);

  const handleBlockUser = async () => {
    if (!firestore || !user || !otherUserId) {
      toast({
        title: 'Error',
        description: 'Cannot block user. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const currentUserRef = doc(firestore, 'users', user.uid);
    const payload = { blockedUsers: arrayUnion(otherUserId) };

    try {
      await updateDoc(currentUserRef, payload);

      toast({
        title: 'User Blocked',
        description: `${otherUser?.displayName} has been blocked.`,
      });
      router.push('/chat'); // Redirect to chat list after blocking
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: currentUserRef.path,
          operation: 'update',
          requestResourceData: payload,
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        console.error('Error blocking user:', error);
        toast({
          title: 'Error',
          description: 'Could not block user.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleUnfriend = async () => {
    if (!firestore || !user || !otherUserId) {
      toast({
        title: 'Error',
        description: 'Cannot unfriend user. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const currentUserRef = doc(firestore, 'users', user.uid);
    const otherUserRef = doc(firestore, 'users', otherUserId);
    const chatId = [user.uid, otherUserId].sort().join('_');
    const chatRef = doc(firestore, 'chats', chatId);

    const batch = writeBatch(firestore);

    // Remove each other from friends lists
    batch.update(currentUserRef, { friends: arrayRemove(otherUserId) });
    batch.update(otherUserRef, { friends: arrayRemove(user.uid) });

    // Delete the chat document
    batch.delete(chatRef);

    try {
      await batch.commit();
      toast({
        title: 'Unfriended',
        description: `You are no longer friends with ${otherUser?.displayName}.`,
      });
      router.push('/chat');
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: `batch operation for unfriend`,
          operation: 'update', // This is a simplification
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        console.error('Error unfriending user:', error);
        toast({
          title: 'Error',
          description: 'Could not unfriend user.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleClearChat = async () => {
    if (!firestore || !user || !otherUserId) return;
    const chatId = [user.uid, otherUserId].sort().join('_');
    const currentUserRef = doc(firestore, 'users', user.uid);
    
    // Instead of deleting messages, we update a timestamp on the user's profile
    // indicating when they cleared this specific chat.
    const fieldPath = `chatsCleared.${chatId}`;
    const payload = { [fieldPath]: serverTimestamp() };

    try {
        await updateDoc(currentUserRef, payload);
        toast({ title: "Chat Cleared", description: "Your view of this chat has been cleared."});
    } catch(error: any) {
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: currentUserRef.path,
                operation: 'update',
                requestResourceData: payload,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error clearing chat:", error);
            toast({ title: "Error", description: "Could not clear your chat view.", variant: "destructive" });
        }
    } finally {
        setClearChatDialogOpen(false);
        router.back(); // Go back to chat screen which will now be empty
    }
  };

  const handleBackgroundChange = async (theme: string) => {
    if (!firestore || !user || !otherUserId) return;
    const chatId = [user.uid, otherUserId].sort().join('_');
    const chatRef = doc(firestore, 'chats', chatId);
    const payload = { backgroundTheme: theme };
    try {
        await updateDoc(chatRef, payload);
        setChatData((prev: any) => ({ ...prev, backgroundTheme: theme }));
        toast({ title: "Background Updated", description: "Your chat background has been changed."});
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: chatRef.path,
                operation: 'update',
                requestResourceData: payload,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error updating background:", error);
            toast({ title: "Error", description: "Could not update chat background.", variant: "destructive" });
        }
    }
  }


  if (!otherUser) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <ContactProfileSheet
        isOpen={isContactSheetOpen}
        onOpenChange={setContactSheetOpen}
        userProfile={otherUser}
      />
      <ClearChatDialog
        isOpen={isClearChatDialogOpen}
        onOpenChange={setClearChatDialogOpen}
        onConfirm={handleClearChat}
        userName={otherUser.displayName}
      />
       <Sheet open={isBackgroundSheetOpen} onOpenChange={setBackgroundSheetOpen}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Change Background</SheetTitle>
                    <SheetDescription>
                        Select a new background for your chat with {otherUser.displayName.split(' ')[0]}.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-4 py-8">
                    {backgroundOptions.map((option) => (
                        <div key={option.value} onClick={() => handleBackgroundChange(option.value)} className="cursor-pointer">
                            <div 
                                className="h-24 w-full rounded-lg flex items-center justify-center border-2"
                                style={{ 
                                    backgroundColor: option.color,
                                    borderColor: chatData?.backgroundTheme === option.value ? 'hsl(var(--primary))' : 'transparent'
                                }}
                            >
                               {chatData?.backgroundTheme === option.value && (
                                   <div className="bg-primary/80 rounded-full p-1">
                                    <Check className="h-6 w-6 text-primary-foreground" />
                                   </div>
                               )}
                            </div>
                            <p className="text-center text-sm mt-2 font-medium">{option.name}</p>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Chat Settings</h1>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-xl space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start text-base py-6"
              onClick={() => setContactSheetOpen(true)}
            >
              <User className="mr-4 h-5 w-5" />
              View Contact
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-base py-6"
              onClick={() => setBackgroundSheetOpen(true)}
            >
              <Palette className="mr-4 h-5 w-5" />
              Change Background
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-base py-6 text-destructive hover:text-destructive hover:bg-destructive/10"
               onClick={handleBlockUser}
            >
              <ShieldX className="mr-4 h-5 w-5" />
              Block {otherUser.displayName}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-base py-6 text-destructive hover:text-destructive hover:bg-destructive/10"
               onClick={handleUnfriend}
            >
              <UserX className="mr-4 h-5 w-5" />
              Unfriend
            </Button>
             <Button
              variant="outline"
              className="w-full justify-start text-base py-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setClearChatDialogOpen(true)}
            >
              <Trash2 className="mr-4 h-5 w-5" />
              Clear Chat
            </Button>
          </div>
        </main>
      </div>
    </>
  );
}
