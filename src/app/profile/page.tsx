'use client';

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase/auth/use-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, LogOut, Shield, Trash2, CheckCheck, Palette, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase/provider';
import { deleteUser, updateProfile } from 'firebase/auth';
import { doc, getDoc, deleteDoc, serverTimestamp, updateDoc, onSnapshot, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ProfilePictureDialog } from '@/components/profile/profile-picture-dialog';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { Separator } from '@/components/ui/separator';
import { getDatabase, ref, set, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { differenceInHours } from 'date-fns';


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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
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
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setUserProfile(data);
              setDisplayName(data.displayName ?? user.displayName ?? '');
              setUsername(data.username ?? '');
              setBio(data.bio ?? '');
              setPhotoURL(data.photoURL ?? user.photoURL ?? null);
          }
      }, (error) => {
          const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}`,
              operation: 'get'
          });
          errorEmitter.emit('permission-error', permissionError);
      });

      return () => unsubscribe();
    }
  }, [user, firestore]);
  
  const canApplyForVerification = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.verifiedBadge?.showBadge) return false;
    if (userProfile.verificationApplicationStatus === 'pending') return false;
    if (!userProfile.lastVerificationRequestAt) return true;
    const lastRequestDate = new Date(userProfile.lastVerificationRequestAt.seconds * 1000);
    return differenceInHours(new Date(), lastRequestDate) >= 24;
  }, [userProfile]);
  
  const canApplyForColorfulName = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.nameColor && userProfile.nameColor !== 'default') return false;
    if (!userProfile.lastColorfulNameRequestAt) return true;
    const lastRequestDate = new Date(userProfile.lastColorfulNameRequestAt.seconds * 1000);
    return differenceInHours(new Date(), lastRequestDate) >= 24;
  }, [userProfile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  const handleApplyForVerification = async () => {
    if (!userProfile || !firestore || !canApplyForVerification) return;
    
    const userDocRef = doc(firestore, 'users', userProfile.uid);
    await updateDoc(userDocRef, {
        verificationApplicationStatus: 'pending',
        lastVerificationRequestAt: serverTimestamp(),
    });

    const subject = encodeURIComponent("Verification Badge Application");
    const body = encodeURIComponent(
        `Hello Love Chat Team,\n\nPlease review my application for a verified badge.\n\nMy Details:\nFull Name: ${displayName}\nUsername: @${username}\n\nI will attach my government-issued ID for verification.\n\nThank you!`
    );
    window.location.href = `mailto:Lovechat0300@gmail.com?subject=${subject}&body=${body}`;
  };


 const getVerificationStatusNode = () => {
    if (!userProfile) return null;

    if (userProfile.verifiedBadge?.showBadge) {
        return (
            <div className="space-y-2 text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCheck className="h-5 w-5" />
                    You are a Verified User
                </h3>
                 <p className="text-sm text-green-600 dark:text-green-500">
                    Your profile is verified by Love Chat.
                </p>
            </div>
        );
    }
    
    if (userProfile.verificationApplicationStatus === 'pending') {
         return (
            <div className="space-y-2 text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <Clock className="h-5 w-5" />
                    Application Under Review
                </h3>
                 <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    Your application is being reviewed. Please wait up to 24 hours.
                </p>
            </div>
        );
    }

    const lastRequestDate = userProfile.lastVerificationRequestAt ? new Date(userProfile.lastVerificationRequestAt.seconds * 1000) : null;
    const canApplyAgain = !lastRequestDate || differenceInHours(new Date(), lastRequestDate) >= 24;

    const isRejectedAndWaiting = userProfile.verificationApplicationStatus === 'rejected' && !canApplyAgain;


    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCheck className="h-5 w-5 text-primary" />
                Verification
            </h3>
            <p className="text-sm text-muted-foreground">
                 {isRejectedAndWaiting
                    ? "Your last application was not approved. You can apply again after 24 hours have passed."
                    : "Apply to get a verified badge on your profile. This helps people know that you're a person of interest."}
            </p>
            <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleApplyForVerification}
                disabled={!canApplyForVerification}
            >
               Apply for Verified Badge
            </Button>
        </div>
    );
  };
  
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
        setNewPhotoPreview(newPhotoDataUrl);
        setIsRemovingPhoto(false);
        setPictureDialogOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemovePicture = async () => {
    setPictureDialogOpen(false);
    setIsRemovingPhoto(true);
    setNewPhotoPreview(null);
  };
  
 const handleSaveChanges = async () => {
    if (!user || !auth || !firestore) return;

    let finalPhotoURL: string | null = photoURL;
    let pictureUpdated = false;

    // Start a write batch
    const batch = writeBatch(firestore);
    const userDocRef = doc(firestore, 'users', user.uid);

    // 1. Handle Photo Upload/Removal
    if (newPhotoPreview) {
      pictureUpdated = true;
      const storage = getStorage();
      const photoRef = storageRef(storage, `profile-pictures/${user.uid}`);
      try {
        await uploadString(photoRef, newPhotoPreview, 'data_url');
        finalPhotoURL = await getDownloadURL(photoRef);
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        toast({ title: 'Upload Failed', description: 'Could not upload your new profile picture.', variant: 'destructive' });
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
        // It's okay if the object doesn't exist, so we only log other errors.
        if (error.code !== 'storage/object-not-found') {
          console.warn('Could not delete old profile picture from storage:', error);
        }
      }
    }

    // 2. Update Auth Profile
    try {
        const updatedAuthProfile: { displayName?: string; photoURL?: string | null } = {};
        if (displayName !== user.displayName) updatedAuthProfile.displayName = displayName;
        if (pictureUpdated) updatedAuthProfile.photoURL = finalPhotoURL;

        if (Object.keys(updatedAuthProfile).length > 0) {
            await updateProfile(user, updatedAuthProfile);
        }
    } catch (error: any) {
        console.error("Error updating auth profile:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update your authentication profile." });
        return;
    }


    // 3. Prepare Firestore Updates
    const updatedFirestoreData: any = {
        displayName: displayName,
        username: username.toLowerCase(),
        bio: bio,
        photoURL: finalPhotoURL,
    };
    batch.update(userDocRef, updatedFirestoreData);
    
    // 4. Update photoURL in all relevant chats
    if (pictureUpdated && userProfile?.chatIds && userProfile.chatIds.length > 0) {
        for (const chatId of userProfile.chatIds) {
            const chatRef = doc(firestore, 'chats', chatId);
            const fieldToUpdate = `participantDetails.${user.uid}.photoURL`;
            batch.update(chatRef, { [fieldToUpdate]: finalPhotoURL });
        }
    }

    // 5. Commit all changes at once
    try {
        await batch.commit();
        toast({ title: "Profile Updated", description: "Your profile has been saved successfully." });
        setNewPhotoPreview(null);
        setIsRemovingPhoto(false);
        setPhotoURL(finalPhotoURL); // Update local state to reflect change immediately
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: 'Batch write for profile update',
            operation: 'update',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
};

 const handleDeleteAccount = async () => {
    if (!user || !firestore || !auth) {
      toast({ title: "Error", description: "User session is not valid.", variant: "destructive" });
      return;
    }
    
    const userDocRef = doc(firestore, 'users', user.uid);
    
    try {
      // Soft delete: Mark the user as disabled
      await updateDoc(userDocRef, {
        isDisabled: true,
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
      
      // Sign the user out
      await auth.signOut();

      toast({ title: "Account Deleted", description: "Your account has been deactivated." });
      router.push('/');

    } catch (error: any) {
      const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { isDisabled: true } });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
        setDeleteDialogOpen(false);
    }
  };


  const handleSignOut = async () => {
    if (auth && user && firestore) {
      const userStatusFirestoreRef = doc(firestore, 'users', user.uid);
      const db = getDatabase();
      const userStatusDatabaseRef = ref(db, '/status/' + user.uid);

      await updateDoc(userStatusFirestoreRef, { isOnline: false, lastSeen: serverTimestamp() });
      await set(userStatusDatabaseRef, { isOnline: false, lastSeen: rtdbServerTimestamp() });

      await auth.signOut();
      router.push('/');
    }
  };

  const handleApplyForColorfulName = async () => {
    if (!userProfile || !firestore || !canApplyForColorfulName) return;

    const userDocRef = doc(firestore, 'users', userProfile.uid);
    await updateDoc(userDocRef, {
        lastColorfulNameRequestAt: serverTimestamp(),
    });

    const subject = encodeURIComponent("Colorful Name Application");
    const body = encodeURIComponent(
        `Hello Love Chat Team,\n\nI would like to apply for a colorful name.\n\nMy Details:\nFull Name: ${displayName}\nUsername: @${username}\n\nPlease review my account. Thank you!`
    );
    window.location.href = `mailto:Lovechat0300@gmail.com?subject=${subject}&body=${body}`;
  };

  const displayPhoto = newPhotoPreview ?? (isRemovingPhoto ? null : photoURL);

  const nameColorClass = useMemo(() => {
    if (!userProfile?.nameColor || userProfile.nameColor === 'default') return '';
    if (userProfile.nameColor === 'gradient') return "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate";
    
    const colorClasses: Record<string, string> = {
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };
    return cn('font-bold', colorClasses[userProfile.nameColor]);
  }, [userProfile?.nameColor]);

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
                    <div className="flex flex-col items-center">
                         <div className="relative mb-4">
                            <Avatar className="h-32 w-32 cursor-pointer" onClick={handleAvatarClick}>
                                <AvatarImage src={displayPhoto ?? undefined} alt={displayName} />
                                <AvatarFallback className="text-4xl">
                                    {getInitials(displayName)}
                                </AvatarFallback>
                            </Avatar>
                             {userProfile?.verifiedBadge?.showBadge && (
                                <div className="absolute bottom-1 right-1">
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
                        {userProfile?.officialBadge?.isOfficial && (
                           <div className="mt-2">
                                <OfficialBadge color={userProfile.officialBadge.badgeColor} />
                           </div>
                        )}
                    </div>
                    
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Full Name</Label>
                             <div className="relative">
                                <Input 
                                    id="displayName" 
                                    value={displayName} 
                                    onChange={(e) => setDisplayName(e.target.value)} 
                                    className={nameColorClass}
                                />
                            </div>
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
                    
                    {getVerificationStatusNode()}
                    
                    <Separator />

                    {userProfile?.nameColor && userProfile.nameColor !== 'default' ? (
                        <div className="space-y-2 text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                            <h3 className="text-lg font-semibold flex items-center justify-center gap-2 text-purple-700 dark:text-purple-400">
                                <Palette className="h-5 w-5" />
                                Special Name Color Activated
                            </h3>
                             <p className="text-sm text-purple-600 dark:text-purple-500 capitalize">
                                Your name color is set to {userProfile.nameColor}.
                            </p>
                        </div>
                    ) : !canApplyForColorfulName ? (
                        <div className="space-y-2 text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <h3 className="text-lg font-semibold flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
                                <Clock className="h-5 w-5" />
                                Application Sent
                            </h3>
                            <p className="text-sm text-yellow-600 dark:text-yellow-500">
                                Please wait 24 hours before applying again.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Palette className="h-5 w-5 text-primary" />
                                Colorful Name
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Apply to get a colorful, animated gradient on your name to stand out.
                            </p>
                            <Button variant="outline" className="w-full" onClick={handleApplyForColorfulName} disabled={!canApplyForColorfulName}>
                               Apply for Colorful Name
                            </Button>
                        </div>
                    )}


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
