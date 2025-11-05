'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? '');

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    router.push('/');
    return null;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoURL(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSaveChanges = () => {
    // Here you would typically update the user profile in Firebase Auth and Firestore
    // For now, we'll just show a toast notification
    toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center gap-4 border-b p-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Profile</h1>
        </header>

        <main className="flex-1 p-4 md:p-8">
            <Card className="mx-auto max-w-xl">
                <CardHeader>
                    <CardTitle>Profile Details</CardTitle>
                    <CardDescription>Update your personal information and photo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex justify-center">
                        <div className="relative">
                            <Avatar className="h-32 w-32 cursor-pointer" onClick={handleAvatarClick}>
                                <AvatarImage src={photoURL} alt={displayName} />
                                <AvatarFallback className="text-4xl">
                                    {getInitials(displayName)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={handleAvatarClick}>
                                <Camera className="h-5 w-5" />
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Full Name</Label>
                        <Input 
                            id="displayName" 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)} 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                            id="email" 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                        />
                    </div>
                    
                    <Button className="w-full" onClick={handleSaveChanges}>Save Changes</Button>
                </CardContent>
            </Card>
        </main>
    </div>
  );
}
