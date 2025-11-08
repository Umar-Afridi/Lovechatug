'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase/auth/use-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, LogOut, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase/provider';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ProfilePictureDialog } from '@/components/profile/profile-picture-dialog';

export default function ProfilePage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPictureDialogOpen, setPictureDialogOpen] = useState(false);

  // States for current data from Firestore
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  
  // State for the new image preview
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  

  useEffect(() => {
    if (user && firestore) {
      // Set initial values from auth object
      setDisplayName(user.displayName ?? '');
      setEmail(user.email ?? '');
      setPhotoURL(user.photoURL ?? null);
      
      // Fetch and set values from Firestore document
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then(docSnap => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setDisplayName(data.displayName ?? user.displayName ?? '');
              setUsername(data.username ?? '');
              setBio(data.bio ?? '');
              setPhotoURL(data.photoURL ?? user.photoURL ?? null);
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
    setPictureDialogOpen(true);
  };
  
  const handleChangePicture = () => {
    setPictureDialogOpen(false);
    fileInputRef.current?.click();
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newPhotoDataUrl = event.target?.result as string;
        // Set the preview, don't save yet
        setNewPhotoPreview(newPhotoDataUrl);
        setIsRemovingPhoto(false); // If we're changing, we're not removing
        setPictureDialogOpen(false); // Close dialog after selecting
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemovePicture = async () => {
    setPictureDialogOpen(false);
    // Set preview to null and flag for removal on save
    setIsRemovingPhoto(true);
    setNewPhotoPreview(null);
  };
  
 const handleSaveChanges = async () => {
    if (!user || !auth || !firestore) return;

    let finalPhotoURL: string | null = photoURL;
    let pictureUpdated = false;

    // 1. Handle picture update if there's a new preview or a removal flag
    if (newPhotoPreview) {
      pictureUpdated = true;
      const storage = getStorage();
      const photoRef = storageRef(storage, `profile-pictures/${user.uid}`);
      try {
        // Correctly use uploadString for data URLs
        await uploadString(photoRef, newPhotoPreview, 'data_url');
        finalPhotoURL = await getDownloadURL(photoRef);
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        toast({
          title: 'Upload Failed',
          description: 'Could not upload your new profile picture.',
          variant: 'destructive',
        });
        return;
      }
    } else if (isRemovingPhoto) {
      pictureUpdated = true;
      finalPhotoURL = null;
      const storage = getStorage();
      const photoRef = storageRef(storage, `profile-pictures/${user.uid}`);
      try {
        // Attempt to delete, but don't block if it fails (e.g., file doesn't exist)
        await deleteObject(photoRef);
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.warn('Could not delete old profile picture from storage:', error);
        }
      }
    }

    // 2. Prepare data for updates
    const updatedAuthProfile: { displayName?: string; photoURL?: string | null } = {};
    if (user.displayName !== displayName) {
        updatedAuthProfile.displayName = displayName;
    }
    // Only add photoURL to auth profile if it has been updated
    if (pictureUpdated) {
        updatedAuthProfile.photoURL = finalPhotoURL;
    }
    
    // Always prepare Firestore data with all fields
    const updatedFirestoreData: any = {
        displayName: displayName,
        username: username.toLowerCase(),
        bio: bio,
        photoURL: finalPhotoURL, // Always update photoURL in Firestore
    };

    // 3. Perform updates
    try {
        // Update Firebase Auth profile only if there are changes
        if (Object.keys(updatedAuthProfile).length > 0) {
            await updateProfile(user, updatedAuthProfile);
        }

        // Always update Firestore document
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, updatedFirestoreData);

        toast({
            title: "Profile Updated",
            description: "Your profile has been saved successfully.",
        });

        // Reset temporary states after successful save
        setNewPhotoPreview(null);
        setIsRemovingPhoto(false);
        // Update the local state to reflect the saved photoURL
        setPhotoURL(finalPhotoURL);

    } catch (error: any) {
        console.error("Error updating profile: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `users/${user.uid}`,
                operation: 'update',
                requestResourceData: updatedFirestoreData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: error.message || "Could not update your profile.",
            });
        }
    }
};


  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    }
  };

  const displayPhoto = newPhotoPreview ?? (isRemovingPhoto ? null : photoURL);

  return (
    <>
        <ProfilePictureDialog 
            isOpen={isPictureDialogOpen}
            onOpenChange={setPictureDialogOpen}
            currentPhotoURL={displayPhoto}
            onRemove={handleRemovePicture}
            onChange={handleChangePicture}
        />
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
                                <AvatarImage src={displayPhoto ?? undefined} alt={displayName} />
                                <AvatarFallback className="text-4xl">
                                    {getInitials(displayName)}
                                </AvatarFallback>
                            </Avatar>
                            <button className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={handleChangePicture}>
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
                    
                    <div className="space-y-2">
                        <Button className="w-full" onClick={handleSaveChanges}>Save Changes</Button>
                        <Button className="w-full" variant="outline" asChild>
                            <Link href="/settings">
                                <Shield className="mr-2 h-4 w-4" />
                                Privacy & Security
                            </Link>
                        </Button>
                        <Button className="w-full" variant="outline" onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    </>
  );
}
