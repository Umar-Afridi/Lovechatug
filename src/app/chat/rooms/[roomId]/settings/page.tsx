'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Image as ImageIcon, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Room } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

export default function RoomSettingsPage({ params }: { params: { roomId: string } }) {
  const roomId = React.use(params.roomId);
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useUser();
  const firestore = useFirestore();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !roomId || !user) {
        return;
    };

    const roomDocRef = doc(firestore, 'rooms', roomId);
    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const roomData = docSnap.data() as Room;
            if (roomData.ownerId !== user.uid) {
                toast({ title: "Access Denied", description: "You are not the owner of this room.", variant: "destructive" });
                router.push(`/chat/rooms/${roomId}`);
                return;
            }
            setRoom({ id: docSnap.id, ...roomData });
            setRoomName(roomData.name);
            setImagePreview(roomData.photoURL || null);
            setLoading(false);
        } else {
            toast({ title: "Room not found", variant: "destructive" });
            router.push('/chat/rooms');
        }
    }, (error) => {
        console.error("Error fetching room settings:", error);
        toast({ title: "Error", description: "Could not load room settings.", variant: "destructive"});
        router.push('/chat/rooms');
    });

    return () => unsubscribe();
  }, [firestore, roomId, user, router, toast]);

  
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if(file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: 'Image too large', description: 'Please select an image smaller than 2MB.', variant: 'destructive'});
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    if (!roomName.trim()) {
      toast({
        title: 'Room name required',
        description: 'Please enter a name for your room.',
        variant: 'destructive',
      });
      return;
    }
    if (!user || !firestore || !room) return;

    setIsSaving(true);

    try {
        let photoURL = room.photoURL || '';

        // Check if the image preview is a new base64 image
        if (imagePreview && imagePreview.startsWith('data:image')) {
            const storage = getStorage();
            const imageRef = storageRef(storage, `room-avatars/${room.id}_${Date.now()}`);
            await uploadString(imageRef, imagePreview, 'data_url');
            photoURL = await getDownloadURL(imageRef);
        }

        const roomRef = doc(firestore, 'rooms', room.id);
        const updatePayload = {
            name: roomName,
            photoURL: photoURL,
        };
        await updateDoc(roomRef, updatePayload);

        toast({
            title: 'Room Updated!',
            description: `Your room settings have been saved.`,
        });
        router.back();

    } catch (error: any) {
        console.error("Error updating room: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({path: `rooms/${room.id}`, operation: 'update'});
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({ title: 'Error', description: 'Could not update the room. Please try again.', variant: 'destructive'});
        }
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!firestore || !room) return;

    setIsSaving(true);
    try {
      const roomRef = doc(firestore, 'rooms', room.id);
      await deleteDoc(roomRef);
      toast({
        title: 'Room Deleted',
        description: 'Your room has been permanently deleted.',
      });
      router.push('/chat/rooms');
    } catch (error: any) {
      console.error("Error deleting room: ", error);
      if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({path: `rooms/${room.id}`, operation: 'delete'});
          errorEmitter.emit('permission-error', permissionError);
      } else {
           toast({ title: 'Error', description: 'Could not delete the room. Please try again.', variant: 'destructive'});
      }
      setIsSaving(false);
    }
  }

  if (loading) {
      return (
          <div className="flex h-screen items-center justify-center">
              <p>Loading settings...</p>
          </div>
      )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Room Settings</h1>
        </div>
        <Button onClick={handleSaveChanges} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4"/>
            {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-md space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar
                className="h-32 w-32 cursor-pointer border-4 border-dashed border-muted-foreground/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <AvatarImage src={imagePreview ?? undefined} />
                <AvatarFallback className="bg-muted">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-5 w-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
            <p className="text-sm text-muted-foreground">Tap icon to change the room picture</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="roomName" className="text-base">Room Name</Label>
            <Input
              id="roomName"
              placeholder="E.g., Friends Hangout"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="h-12 text-lg"
              maxLength={50}
            />
          </div>

          <div className="space-y-4">
             <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Security Notice</AlertTitle>
                <AlertDescription>
                    Currently, all rooms are public. Room locking and password features are coming soon!
                </AlertDescription>
            </Alert>
          </div>
          
           <div className="space-y-2 pt-8">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Room
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete your room. All data will be lost and this action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteRoom} className="bg-destructive hover:bg-destructive/90">
                        Yes, Delete Room
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
           </div>
        </div>
      </main>
    </div>
  );
}
