'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Camera, Trash2 } from 'lucide-react';
import type { Room } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useFirebaseApp } from '@/firebase/provider';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { cn } from '@/lib/utils';


interface RoomSettingsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  isOwner: boolean;
}

const THEMES = ['blue', 'green', 'red', 'purple', 'pink', 'yellow'] as const;

export function RoomSettingsSheet({
  isOpen,
  onOpenChange,
  room,
  isOwner,
}: RoomSettingsSheetProps) {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = getStorage(app);
  const { toast } = useToast();

  const [roomName, setRoomName] = useState(room?.name || '');
  const [isLocked, setIsLocked] = useState(room?.isLocked || false);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (room) {
      setRoomName(room.name);
      setIsLocked(room.isLocked || false);
      setNewPhotoPreview(null);
      setIsRemovingPhoto(false);
    }
  }, [room]);


  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : 'R';
  const displayPhoto = newPhotoPreview ?? (isRemovingPhoto ? null : room?.photoURL);
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewPhotoPreview(event.target?.result as string);
        setIsRemovingPhoto(false);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSaveChanges = async () => {
    if (!room || !isOwner || !firestore) return;
    setIsSaving(true);
    
    let finalPhotoURL = room.photoURL;

    try {
        if (newPhotoPreview) {
          const photoRef = storageRef(storage, `room-avatars/${room.id}-${Date.now()}`);
          await uploadString(photoRef, newPhotoPreview, 'data_url');
          finalPhotoURL = await getDownloadURL(photoRef);
        } else if (isRemovingPhoto && room.photoURL) {
          try {
            const photoRef = storageRef(storage, room.photoURL);
            await deleteObject(photoRef);
          } catch (error: any) {
             if (error.code !== 'storage/object-not-found') throw error;
          }
          finalPhotoURL = undefined;
        }

        const roomRef = doc(firestore, 'rooms', room.id);
        await updateDoc(roomRef, {
            name: roomName,
            isLocked: isLocked,
            photoURL: finalPhotoURL,
        });

        toast({ title: 'Success', description: 'Room settings have been updated.' });
        onOpenChange(false);

    } catch (error) {
        console.error("Error updating room:", error);
        toast({ title: 'Error', description: 'Failed to update room settings.', variant: 'destructive'});
    } finally {
        setIsSaving(false);
    }
  };

  const handleThemeChange = async (theme: Room['theme']) => {
    if (!room || !isOwner || !firestore) return;
     try {
        const roomRef = doc(firestore, 'rooms', room.id);
        await updateDoc(roomRef, { theme: theme });
     } catch (error) {
         toast({ title: 'Error', description: 'Failed to update theme.', variant: 'destructive'});
     }
  }

  if (!isOwner || !room) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Room Settings</SheetTitle>
          <SheetDescription>
            Manage your room's settings and appearance.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 space-y-6 overflow-y-auto p-1">
            <div className="space-y-4 text-center">
                <div className="relative w-24 h-24 mx-auto">
                    <Avatar className="w-full h-full">
                        <AvatarImage src={displayPhoto || undefined} />
                        <AvatarFallback className="text-3xl">{getInitials(roomName)}</AvatarFallback>
                    </Avatar>
                    <Button size="icon" variant="outline" className="absolute bottom-0 right-0 rounded-full h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                        <Camera className="h-4 w-4" />
                    </Button>
                    {displayPhoto && (
                         <Button size="icon" variant="destructive" className="absolute top-0 right-0 rounded-full h-8 w-8" onClick={() => setIsRemovingPhoto(true)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/png, image/jpeg, image/gif"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <Label htmlFor="room-name">Room Name</Label>
                <Input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div>
                    <Label htmlFor="lock-room">Lock Room</Label>
                    <p className="text-xs text-muted-foreground">Prevent new members from joining.</p>
                </div>
                <Switch id="lock-room" checked={isLocked} onCheckedChange={setIsLocked} />
            </div>
            
            <Separator />

            <div>
                <h3 className="mb-4 text-lg font-medium">Themes</h3>
                <div className="grid grid-cols-3 gap-2">
                    {THEMES.map(themeColor => (
                        <Button
                            key={themeColor}
                            variant={room.theme === themeColor ? 'default' : 'outline'}
                            onClick={() => handleThemeChange(themeColor)}
                            className={cn('capitalize justify-start', `hover:bg-${themeColor}-500/20 hover:border-${themeColor}-500/50`)}
                        >
                           <span className={cn('w-4 h-4 rounded-full mr-2', `bg-${themeColor}-500`)}></span>
                           {themeColor}
                        </Button>
                    ))}
                     <Button
                        variant={!room.theme ? 'default' : 'outline'}
                        onClick={() => handleThemeChange(undefined)}
                        className="capitalize"
                    >
                       Default
                    </Button>
                </div>
            </div>

             <Separator />

              <div>
                <h3 className="mb-2 text-lg font-medium">Manage Admins</h3>
                <div className="p-4 text-center bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">This feature is coming soon!</p>
                </div>
              </div>


        </div>
        
        <SheetFooter>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
