'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export default function CreateRoomPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomName, setRoomName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      toast({
        title: 'Room name required',
        description: 'Please enter a name for your room.',
        variant: 'destructive',
      });
      return;
    }

    // In a real app, you would upload the image, create a Firestore document for the room,
    // and then navigate to the new room's ID.
    // For this UI-only step, we'll just navigate to a placeholder room ID.
    const newRoomId = 'placeholder-room-123';
    toast({
      title: 'Room Created!',
      description: `Your room "${roomName}" is ready.`,
    });
    router.push(`/chat/rooms/${newRoomId}`);
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
            <p className="text-sm text-muted-foreground">Tap icon to add a room picture</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="roomName" className="text-base">Room Name</Label>
            <Input
              id="roomName"
              placeholder="E.g., Friends Hangout"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="h-12 text-lg"
            />
          </div>

          <Button size="lg" className="w-full text-lg py-6" onClick={handleCreateRoom}>
            Create Room
          </Button>
        </div>
      </main>
    </div>
  );
}
