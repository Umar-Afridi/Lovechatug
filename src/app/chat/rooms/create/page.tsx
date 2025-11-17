'use client';

import React, { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Camera, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function CreateRoomPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [roomName, setRoomName] = useState('');
  const [roomPhoto, setRoomPhoto] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateRoom = async () => {
    if (!user || !firestore) {
      toast({ title: 'Error', description: 'You must be logged in to create a room.', variant: 'destructive' });
      return;
    }
    if (roomName.trim().length < 3) {
      toast({ title: 'Invalid Name', description: 'Room name must be at least 3 characters long.', variant: 'destructive' });
      return;
    }
    
    setIsCreating(true);
    let photoURL: string | null = null;

    try {
        if (roomPhoto) {
            const storage = getStorage();
            const photoRef = storageRef(storage, `room-avatars/${Date.now()}-${user.uid}`);
            await uploadString(photoRef, roomPhoto, 'data_url');
            photoURL = await getDownloadURL(photoRef);
        }
        
        const userProfileDoc = await getDoc(doc(firestore, 'users', user.uid));
        const userProfile = userProfileDoc.data() as UserProfile;

        const newRoom = {
            name: roomName,
            ownerId: user.uid,
            ownerIsOfficial: userProfile?.officialBadge?.isOfficial || false,
            photoURL: photoURL,
            createdAt: serverTimestamp(),
            members: [],
            memberCount: 0,
            kickedUsers: {},
            lockedSlots: [],
        };

        const roomsCollection = collection(firestore, 'rooms');
        const docRef = await addDoc(roomsCollection, newRoom);
        
        toast({ title: 'Room Created!', description: `${roomName} is now live.` });
        router.push(`/chat/rooms/${docRef.id}`);

    } catch (error) {
        console.error("Error creating room:", error);
        toast({ title: 'Error', description: 'Could not create the room. Please try again.', variant: 'destructive' });
        setIsCreating(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setRoomPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'R';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Create a New Room</h1>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-xl space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-32 w-32 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={roomPhoto ?? undefined} />
                <AvatarFallback className="text-4xl bg-muted">
                    {roomName ? getInitials(roomName) : <ImageIcon className="h-12 w-12 text-muted-foreground"/>}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-5 w-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/gif"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-sm text-muted-foreground">Tap image to upload a room photo</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomName" className="text-base">Room Name</Label>
            <Input
              id="roomName"
              placeholder="e.g., Late Night Vibes"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="p-4 text-lg"
            />
          </div>

          <Button
            size="lg"
            className="w-full text-lg py-6"
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Room & Go Live'}
          </Button>
        </div>
      </main>
    </div>
  );
}
