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
import { ArrowLeft, Camera, LogOut, Shield, Trash2, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase/provider';
import { deleteUser, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ProfilePictureDialog } from '@/components/profile/profile-picture-dialog';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { Separator } from '@/components/ui/separator';
import { getDatabase, ref, set, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';


export default function ProfilePage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPictureDialogOpen, setPictureDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // States for current data from Firestore
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
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
              setUserProfile(data);
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
     if (pictureUpdated) {
        updatedAuthProfile.photoURL = finalPhotoURL;
    }
    
    // We only update the fields that can be changed by the user.
    // 'verifiedBadge' is now only updatable from the backend.
    const updatedFirestoreData: any = {
        displayName: displayName,
        username: username.toLowerCase(),
        bio: bio,
        photoURL: finalPhotoURL,
    };

    // 3. Perform updates
    try {
        // Update Firebase Auth profile only if there are changes
        if (Object.keys(updatedAuthProfile).length > 0) {
            await updateProfile(user, updatedAuthProfile);
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, updatedFirestoreData);

        toast({
            title: "Profile Updated",
            description: "Your profile has been saved successfully.",
        });

        // Reset temporary states and update local state after successful save
        setNewPhotoPreview(null);
        setIsRemovingPhoto(false);
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

 const handleDeleteAccount = async () => {
    if (!user || !firestore || !auth || !user.email) {
      toast({ title: "Error", description: "User session is not valid.", variant: "destructive" });
      return;
    }
    
    const userDocRef = doc(firestore, 'users', user.uid);
    const deletedUserDocRef = doc(firestore, 'deletedUsers', user.email);
    const storage = getStorage();
    const photoRef = storageRef(storage, `profile-pictures/${user.uid}`);

    try {
      // 1. Tombstone the user's email to prevent re-registration
      await setDoc(deletedUserDocRef, {
        email: user.email,
        deletedAt: serverTimestamp(),
      });
      
      // 2. Delete profile picture from Storage, if it exists
      if (photoURL) {
        try {
          await deleteObject(photoRef);
        } catch (storageError: any) {
          if (storageError.code !== 'storage/object-not-found') {
            console.warn('Could not delete profile picture, but proceeding with account deletion.', storageError);
          }
        }
      }

      // 3. Delete user document from Firestore
      await deleteDoc(userDocRef);

      // 4. Delete user from Firebase Authentication
      await deleteUser(auth.currentUser!);

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });

      router.push('/');
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (error.code === 'auth/requires-recent-login') {
          toast({
            variant: "destructive",
            title: "Action Required",
            description: "This is a sensitive action. Please log out and log back in before deleting your account.",
        });
      } else if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
                path: userDocRef.path, // or deletedUserDocRef.path
                operation: 'delete', // or 'create'
            });
          errorEmitter.emit('permission-error', permissionError);
      }
      else {
        toast({
          variant: "destructive",
          title: "Deletion Failed",
          description: error.message || "Could not delete your account. Please try again.",
        });
      }
    } finally {
        setDeleteDialogOpen(false);
    }
  };


  const handleSignOut = async () => {
    if (auth && user && firestore) {
      const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
      const db = getDatabase();
      const userStatusDatabaseRef = ref(db, '/status/' + user.uid);

      // Set offline in both databases before signing out
      await updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() });
      await set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });

      await auth.signOut();
      router.push('/');
    }
  };

  const handleApplyForBadge = () => {
    const subject = encodeURIComponent("Verified Badge Application");
    const body = encodeURIComponent(
        `Hello Love Chat Team,\n\nI would like to apply for a verified badge.\n\nMy Details:\nFull Name: ${displayName}\nUsername: @${username}\n\nPlease review my account. Thank you!`
    );
    window.location.href = `mailto:Lovechat0300@gmail.com?subject=${subject}&body=${body}`;
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
        <DeleteAccountDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDeleteAccount}
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
                             {userProfile?.verifiedBadge?.showBadge && (
                                <div className="absolute bottom-1 -right-1">
                                    <VerifiedBadge color={userProfile.verifiedBadge.badgeColor} className="h-8 w-8"/>
                                </div>
                            )}
                            <button className="absolute -bottom-1 right-8 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={handleChangePicture}>
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

                    <Separator />
                    
                     <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <CheckCheck className="h-5 w-5 text-primary" />
                            Verification
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Apply to get a verified badge on your profile. This helps people know that you're a person of interest.
                        </p>
                        <Button variant="outline" className="w-full" onClick={handleApplyForBadge}>
                           Apply for Verified Badge
                        </Button>
                    </div>

                    <div className="space-y-2 pt-4">
                        <Button className="w-full" onClick={handleSaveChanges}>Save Changes</Button>
                        <Button className="w-full" variant="outline" asChild>
                            <Link href="/settings">
                                <Shield className="mr-2 h-4 w-4" />
                                Privacy & Security
                            </Link>
                        </Button>
                        <Button className="w-full" variant="outline" onClick={() => setDeleteDialogOpen(true)} >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Account
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
