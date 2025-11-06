'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase/provider';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ProfilePage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  
  useEffect(() => {
    if (user && firestore) {
      setDisplayName(user.displayName ?? '');
      setEmail(user.email ?? '');
      setPhotoURL(user.photoURL ?? '');
      
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then(docSnap => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setUsername(data.username ?? '');
              setBio(data.bio ?? '');
              // Use photo from Firestore if it exists, as it might be a data URI
              if (data.photoURL) {
                setPhotoURL(data.photoURL);
              }
          }
      });
    }
  }, [user, firestore]);
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);


  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
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
  
  const handleSaveChanges = async () => {
    if (!user || !auth || !firestore) return;

    try {
        // Update Firebase Auth profile first (only for properties that are not data URIs)
        await updateProfile(user, {
            displayName: displayName,
        });

        // Then update the Firestore document, which can store the data URI for the photo
        const userDocRef = doc(firestore, 'users', user.uid);
        const updatedData = {
            displayName: displayName,
            username: username.toLowerCase(),
            photoURL: photoURL,
            bio: bio,
        };

        updateDoc(userDocRef, updatedData)
            .then(() => {
                 toast({
                    title: "Profile Updated",
                    description: "Your profile has been saved successfully.",
                });
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: updatedData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

    } catch (error: any) {
        console.error("Error updating auth profile: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Could not update your authentication profile.",
        });
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Profile</h1>
        </header>

        <main className="flex-1 p-4 md:p-8">
            <div className="mx-auto max-w-xl space-y-8">
                <div className="flex justify-center">
                    <div className="relative">
                        <Avatar className="h-32 w-32 cursor-pointer" onClick={handleAvatarClick}>
                            <AvatarImage src={photoURL} alt={displayName} />
                            <AvatarFallback className="text-4xl">
                                {getInitials(displayName)}
                            </AvatarFallback>
                        </Avatar>
                        <button className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={handleAvatarClick}>
                            <Camera className="h-5 w-5" />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Full Name</Label>
                        <Input 
                            id="displayName" 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)} 
                        />
                    </div>

                     <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input 
                            id="username" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                            id="email" 
                            type="email" 
                            value={email} 
                            readOnly
                            className="focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 cursor-not-allowed opacity-70"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea 
                            id="bio" 
                            value={bio} 
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us a little about yourself"
                            rows={3}
                        />
                    </div>
                </div>
                
                <Button className="w-full" onClick={handleSaveChanges}>Save Changes</Button>

                <Button className="w-full" variant="outline" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </main>
    </div>
  );
}
