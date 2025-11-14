'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { UserProfile } from '@/lib/types';


export default function CreateRoomPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useUser();
  const firestore = useFirestore();

  const [roomName, setRoomName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then((docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      });
    }
  }, [user, firestore]);
  
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

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast({
        title: 'Room name required',
        description: 'Please enter a name for your room.',
        variant: 'destructive',
      });
      return;
    }
    if (!user || !firestore || !userProfile) {
        toast({ title: 'Authentication Error', description: 'You must be logged in to create a room.', variant: 'destructive'});
        return;
    }

    setIsCreating(true);

    try {
        let photoURL = '';
        if (imagePreview) {
            const storage = getStorage();
            const imageRef = storageRef(storage, `room-avatars/${user.uid}_${Date.now()}`);
            await uploadString(imageRef, imagePreview, 'data_url');
            photoURL = await getDownloadURL(imageRef);
        }

        const roomsRef = collection(firestore, 'rooms');
        const newRoomData = {
            name: roomName,
            ownerId: user.uid,
            ownerIsOfficial: userProfile.officialBadge?.isOfficial ?? false,
            photoURL: photoURL,
            createdAt: serverTimestamp(),
            members: [user.uid],
            memberCount: 1,
        };
        const docRef = await addDoc(roomsRef, newRoomData);

        // Also add the owner as the first member in the subcollection
        const memberRef = doc(firestore, 'rooms', docRef.id, 'members', user.uid);
        await setDoc(memberRef, {
            userId: user.uid,
            micSlot: 0, // 0 for owner
            isMuted: false,
        });

        toast({
            title: 'Room Created!',
            description: `Your room "${roomName}" is ready.`,
        });
        router.push(`/chat/rooms/${docRef.id}`);

    } catch (error: any) {
        console.error("Error creating room: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({path: 'rooms', operation: 'create'});
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({ title: 'Error', description: 'Could not create the room. Please try again.', variant: 'destructive'});
        }
        setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Create a New Room</h1>
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
            <p className="text-sm text-muted-foreground">Tap icon to add a room picture (optional)</p>
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

          <Button size="lg" className="w-full text-lg py-6" onClick={handleCreateRoom} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Room'}
          </Button>
        </div>
      </main>
    </div>
  );
}
