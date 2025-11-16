'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { useRoomContext } from '../../layout';
import {
  doc,
  onSnapshot,
  collection,
  query,
  updateDoc,
  deleteDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
  arrayRemove,
  arrayUnion,
  getDoc,
  orderBy,
  limit,
  increment,
  getDocs,
  where,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  Crown,
  Lock,
  Mic,
  MicOff,
  MoreVertical,
  Paperclip,
  Send,
  Shield,
  Trash2,
  Unlock,
  UserX,
  Volume2,
  VolumeX,
  PhoneOff,
  View,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Room, RoomMember, UserProfile, RoomMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { OfficialBadge } from '@/components/ui/official-badge';
import { ContactProfileSheet } from '@/components/chat/contact-profile-sheet';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';


const MIC_SLOTS = 8;
const SUPER_ADMIN_SLOT = -1;
const OWNER_SLOT = 0;

function applyNameColor(name: string, color?: UserProfile['nameColor']) {
    if (!color || color === 'default') {
        return name;
    }
    if (color === 'gradient') {
        return <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate">{name}</span>;
    }
    
    const colorClasses: Record<Exclude<NonNullable<UserProfile['nameColor']>, 'default' | 'gradient'>, string> = {
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        pink: 'text-pink-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
    };

    return <span className={cn('font-bold', colorClasses[color])}>{name}</span>;
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setCurrentRoom, leaveCurrentRoom: contextLeaveRoom, inboxCount } = useRoomContext();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [message, setMessage] = useState('');
  
  const [isDeafened, setIsDeafened] = useState(false);
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [joinTimestamp, setJoinTimestamp] = useState<Timestamp | null>(null);


  const [dialogState, setDialogState] = useState<{ isOpen: boolean, action: 'delete' | 'leave' | 'kick' | null, targetMember?: RoomMember | null }>({ isOpen: false, action: null });
  
  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserSlot = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);
  const isMuted = useMemo(() => currentUserSlot?.isMuted ?? false, [currentUserSlot]);

 const handleLeaveRoom = useCallback(async (isKickOrDelete = false) => {
    if (!firestore || !authUser || !currentUserSlot) return;

    setMessages([]); 
    contextLeaveRoom();
    
    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    const roomRef = doc(firestore, 'rooms', roomId);

    try {
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists()) {
            const batch = writeBatch(firestore);
            batch.delete(memberRef);

            // Do not decrement count if the user is a super admin (not a regular member)
            // or if the whole room is being deleted.
            if (!isKickOrDelete && currentUserSlot.micSlot !== SUPER_ADMIN_SLOT) { 
                const roomDoc = await getDoc(roomRef);
                if (roomDoc.exists() && roomDoc.data().memberCount > 0) {
                  batch.update(roomRef, { memberCount: increment(-1) });
                }
            }
            await batch.commit();
        }
    } catch(e) {
        console.warn("Could not leave room properly, room might be deleted.", e);
    }
    router.push('/chat/rooms');
  }, [firestore, authUser, roomId, router, contextLeaveRoom, currentUserSlot]);
  
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
      handleLeaveRoom();
  }, [handleLeaveRoom]);
  
  useEffect(() => {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  // --- Main Data Fetching and Room Joining Logic ---
  useEffect(() => {
    if (!firestore || !roomId || !authUser) return;
    
    setJoinTimestamp(Timestamp.now());

    const roomRef = doc(firestore, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as Room;
        setRoom(roomData);
        setCurrentRoom(roomData);
        if (roomData.kickedUsers && roomData.kickedUsers[authUser.uid]) {
            toast({ title: "You've been kicked", description: "You have been removed from this room by the owner.", variant: 'destructive'});
            router.push('/chat/rooms');
        }
      } else {
        toast({ title: 'Room not found', description: 'This room may have been deleted.', variant: 'destructive' });
        router.push('/chat/rooms');
      }
    }, (error) => {
      console.error("Error fetching room:", error);
      router.push('/chat/rooms');
    });

    const membersRef = collection(firestore, 'rooms', roomId, 'members');
    const qMembers = query(membersRef);
    const unsubMembers = onSnapshot(qMembers, async (snapshot) => {
        const membersList = snapshot.docs.map(d => d.data() as RoomMember);
        setMembers(membersList);

        const newMemberIds = membersList.map(m => m.userId).filter(id => !memberProfiles[id]);
        if (newMemberIds.length > 0) {
            const profilesRef = collection(firestore, 'users');
            const chunks = [];
            for (let i = 0; i < newMemberIds.length; i += 30) {
                chunks.push(newMemberIds.slice(i, i + 30));
            }

            const newProfiles: Record<string, UserProfile> = {};
            for (const chunk of chunks) {
                const profilesQuery = query(profilesRef, where('uid', 'in', chunk));
                const profilesSnapshot = await getDocs(profilesQuery);
                profilesSnapshot.forEach(doc => {
                    newProfiles[doc.id] = doc.data() as UserProfile;
                });
            }
            setMemberProfiles(prev => ({...prev, ...newProfiles}));
        }
    });

    const joinRoom = async () => {
        const userProfileDoc = await getDoc(doc(firestore, 'users', authUser.uid));
        if (!userProfileDoc.exists()) return;
        const userProfile = userProfileDoc.data() as UserProfile;

        const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
        const roomRef = doc(firestore, 'rooms', roomId);
        
        const memberDoc = await getDoc(memberRef);
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) return;
        const currentRoomData = roomDoc.data() as Room;
        
        // Determine the initial mic slot. Default to null (listener).
        let initialMicSlot: number | null = null;
        let isJoiningAsSuperAdmin = false;

        // Only the owner gets a mic slot automatically.
        if (currentRoomData.ownerId === authUser.uid) {
            initialMicSlot = OWNER_SLOT;
        } else if (userProfile?.officialBadge?.isOfficial) {
            isJoiningAsSuperAdmin = true;
            // Super admins also join as listeners by default.
            initialMicSlot = null;
        }

        if (!memberDoc.exists()) {
            const batch = writeBatch(firestore);
            const memberData = { userId: authUser.uid, micSlot: initialMicSlot, isMuted: true };
            batch.set(memberRef, memberData);
            
            // Only increment member count if it's not the owner joining their own room for the first time
            // and not a super admin. Let's count super admins as regular members for simplicity unless specified otherwise.
            if (currentRoomData.ownerId !== authUser.uid) {
              batch.update(roomRef, { memberCount: increment(1) });
            }
            
            const notificationMessage = {
                senderId: 'system',
                senderName: 'System',
                content: `${userProfile.displayName} joined the room.`,
                timestamp: serverTimestamp(),
                type: 'notification' as const,
            };
            const messageDocRef = doc(collection(firestore, 'rooms', roomId, 'messages'));
            batch.set(messageDocRef, notificationMessage);
            
            await batch.commit();
        } else {
            const currentMemberData = memberDoc.data() as RoomMember;
             // If the owner rejoins and isn't in the owner slot, put them there.
            if (currentRoomData.ownerId === authUser.uid && currentMemberData.micSlot !== OWNER_SLOT) {
                await updateDoc(memberRef, { micSlot: OWNER_SLOT, isMuted: true });
            }
        }
    };
    
    joinRoom();

    return () => {
      unsubRoom();
      unsubMembers();
      setCurrentRoom(null); // Clear context on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, roomId, authUser?.uid]);

  // Separate effect for messages to handle joinTimestamp
  useEffect(() => {
    if (!firestore || !roomId || !joinTimestamp) return;

    const messagesRef = collection(firestore, 'rooms', roomId, 'messages');
    const qMessages = query(
      messagesRef,
      where('timestamp', '>=', joinTimestamp),
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(prevMessages => {
          const newMsgs = snapshot.docs
              .map(d => ({ id: d.id, ...d.data() } as RoomMessage))
              .filter(newMsg => !prevMessages.some(prevMsg => prevMsg.id === newMsg.id));
          
          if (newMsgs.length > 0) {
              return [...prevMessages, ...newMsgs];
          }
          return prevMessages;
      });
    });

    return () => {
      unsubMessages();
    };
  }, [firestore, roomId, joinTimestamp]);


  const handleDeleteRoom = async () => {
     if (!firestore || !isOwner || !room) return;
    try {
        await deleteDoc(doc(firestore, 'rooms', room.id));
        toast({ title: 'Room Deleted', description: 'The room has been successfully deleted.' });
        router.push('/chat/rooms');
    } catch(e) {
        console.error("Error deleting room", e);
        toast({ title: 'Error', description: 'Failed to delete the room.', variant: 'destructive' });
    }
  };
  
  const handleKickUser = async (targetMember?: RoomMember | null) => {
    if (!firestore || !isOwner || !targetMember || targetMember.userId === authUser?.uid) return;
    const roomRef = doc(firestore, 'rooms', roomId);
    const memberRefToKick = doc(firestore, 'rooms', roomId, 'members', targetMember.userId);
    
    const batch = writeBatch(firestore);
    batch.update(roomRef, { 
        [`kickedUsers.${targetMember.userId}`]: serverTimestamp(),
        memberCount: increment(-1)
    });
    batch.delete(memberRefToKick);

    await batch.commit();
    toast({title: "User Kicked", description: `${memberProfiles[targetMember.userId]?.displayName} has been removed.`})
    setDialogState({ isOpen: false, action: null, targetMember: null });
  };
  
  const handleToggleMute = async () => {
    if (!firestore || !authUser || !currentUserSlot) return;
    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    await setDoc(memberRef, { isMuted: !isMuted }, { merge: true });
  };

  const handleSendMessage = async () => {
    if (!firestore || !authUser || !memberProfiles[authUser.uid] || message.trim() === '') return;
    const {displayName, photoURL} = memberProfiles[authUser.uid];
    const messagesRef = collection(firestore, 'rooms', roomId, 'messages');
    await addDoc(messagesRef, {
        senderId: authUser.uid,
        senderName: displayName,
        senderPhotoURL: photoURL,
        content: message,
        timestamp: serverTimestamp(),
        type: 'text'
    });
    setMessage('');
  };
  
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : '?';
  
  const handleViewProfile = (userId: string) => {
    const profile = memberProfiles[userId];
    if (profile) {
      setViewedProfile(profile);
      setContactSheetOpen(true);
    }
  };
  
  const handleToggleLock = async (slotNumber: number) => {
    if (!isOwner || !room) return;
    const roomRef = doc(firestore, 'rooms', roomId);
    if (room.lockedSlots?.includes(slotNumber)) {
        await updateDoc(roomRef, { lockedSlots: arrayRemove(slotNumber) });
    } else {
        await updateDoc(roomRef, { lockedSlots: arrayUnion(slotNumber) });
    }
  };
  
  const handleForceLeaveMic = async (targetMember: RoomMember) => {
    if (!isOwner || !targetMember) return;
    const memberRef = doc(firestore, 'rooms', roomId, 'members', targetMember.userId);
    await updateDoc(memberRef, { micSlot: null });
    toast({ title: 'User Moved', description: 'The user has been moved from the mic.' });
  };

  if (!room || !authUser || !currentUserSlot) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <p>Joining room...</p>
      </div>
    );
  }
  
    const renderSlot = (slotNumber: number) => {
        const memberInSlot = members.find(m => m.micSlot === slotNumber);
        const profile = memberInSlot ? memberProfiles[memberInSlot.userId] : null;
        
        const isLocked = room?.lockedSlots?.includes(slotNumber) || false;
        const isSelf = memberInSlot?.userId === authUser.uid;
        
        const handleTakeSeat = async () => {
            if (!currentUserSlot || currentUserSlot.micSlot !== null) return;
            const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
            await updateDoc(memberRef, { micSlot: slotNumber });
        };
        
        const handleLeaveSeat = async () => {
            if (!currentUserSlot || !isSelf) return;
            const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
            await updateDoc(memberRef, { micSlot: null });
        }
        
        const content = (
             <div className="relative flex flex-col items-center justify-center space-y-1 group">
                <div className={cn("relative h-20 w-20 rounded-full bg-muted flex items-center justify-center transition-all duration-200", 
                                  memberInSlot ? "ring-2 ring-offset-2 ring-offset-background" : "border-2 border-dashed border-muted-foreground/50",
                                  memberInSlot && memberInSlot.isMuted ? "ring-destructive" : "ring-primary",
                                  isSelf && !isMuted && "talking-indicator"
                                  )}>
                    {profile ? (
                        <Avatar className="h-full w-full">
                            <AvatarImage src={profile.photoURL} />
                            <AvatarFallback className="text-2xl">{getInitials(profile.displayName)}</AvatarFallback>
                        </Avatar>
                    ) : isLocked ? (
                         <Lock className="text-muted-foreground h-8 w-8" />
                    ): (
                         <Mic className={cn("text-muted-foreground h-8 w-8")}/>
                    )}
                    
                    {memberInSlot && memberInSlot.isMuted && <div className="absolute bottom-0 right-0 bg-destructive rounded-full p-1"><MicOff className="h-3 w-3 text-white"/></div>}
                     {profile?.verifiedBadge?.showBadge && (
                        <div className="absolute bottom-0 left-0">
                            <VerifiedBadge color={profile.verifiedBadge.badgeColor} className="h-5 w-5"/>
                        </div>
                    )}
                     {slotNumber === OWNER_SLOT && (
                       <div className="absolute -top-2 -right-2 h-8 w-8 bg-background rounded-full p-1 border-2 flex items-center justify-center border-yellow-500">
                         <Crown className="h-5 w-5 text-yellow-500"/>
                       </div>
                    )}
                    {slotNumber === SUPER_ADMIN_SLOT && (
                         <div className="absolute -top-2 -right-2 h-8 w-8 bg-background rounded-full p-1 border-2 flex items-center justify-center border-purple-500">
                            <Shield className="h-5 w-5 text-purple-500"/> 
                         </div>
                    )}
                </div>
                 <div className="h-5 flex items-center justify-center text-center">
                    {profile ? (
                         <div className="text-sm font-medium truncate max-w-[80px]">
                           {applyNameColor(profile.displayName, profile.nameColor)}
                         </div>
                    ) : slotNumber === OWNER_SLOT ? (
                        <p className={cn("text-sm font-semibold")}>OWNER</p>
                    ) : slotNumber === SUPER_ADMIN_SLOT ? (
                         <p className={cn("text-sm font-semibold")}>SUPER</p>
                    ) : (
                         !isLocked && <p className="text-sm text-muted-foreground">{slotNumber}</p>
                    )}
                </div>
            </div>
        )
        
        return (
            <DropdownMenu key={slotNumber}>
                <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer">{content}</div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {/* Owner viewing another user */}
                    {isOwner && memberInSlot && !isSelf && (
                        <>
                           <DropdownMenuItem onClick={() => setDialogState({ isOpen: true, action: 'kick', targetMember: memberInSlot })}>
                                <UserX className="mr-2 h-4 w-4"/> Kick User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => profile && handleViewProfile(profile.uid)}>
                                <View className="mr-2 h-4 w-4"/> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleForceLeaveMic(memberInSlot)}>
                                <MicOff className="mr-2 h-4 w-4" /> Move from Mic
                            </DropdownMenuItem>
                        </>
                    )}
                    
                    {/* Any user viewing another user */}
                    {!isOwner && memberInSlot && !isSelf && (
                         <DropdownMenuItem onClick={() => profile && handleViewProfile(profile.uid)}>
                            <View className="mr-2 h-4 w-4"/> View Profile
                        </DropdownMenuItem>
                    )}
                    
                    {/* Owner managing an empty, non-owner mic slot */}
                    {isOwner && !memberInSlot && slotNumber >= 1 && (
                        <>
                            <DropdownMenuItem onClick={() => handleToggleLock(slotNumber)}>
                                {isLocked ? <Unlock className="mr-2 h-4 w-4"/> : <Lock className="mr-2 h-4 w-4"/>}
                                {isLocked ? 'Unlock Mic' : 'Lock Mic'}
                            </DropdownMenuItem>
                             {!isLocked && currentUserSlot?.micSlot === null && (
                                <DropdownMenuItem onClick={handleTakeSeat}>
                                    <Mic className="mr-2 h-4 w-4"/> Take Seat
                                </DropdownMenuItem>
                             )}
                        </>
                    )}

                    {/* Any user wanting to take an empty, unlocked seat */}
                    {!memberInSlot && !isLocked && currentUserSlot?.micSlot === null && (
                         <DropdownMenuItem onClick={handleTakeSeat}>
                            <Mic className="mr-2 h-4 w-4"/> Take Seat
                         </DropdownMenuItem>
                    )}
                    
                    {/* User managing their own occupied seat (not owner's seat) */}
                    {isSelf && slotNumber === currentUserSlot?.micSlot && currentUserSlot.micSlot >= 1 && (
                         <DropdownMenuItem onClick={handleLeaveSeat}>
                            <MicOff className="mr-2 h-4 w-4"/> Leave Seat
                         </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
    
    const renderMessage = (msg: RoomMessage, index: number) => {
        const senderProfile = memberProfiles[msg.senderId];
        const isNotification = msg.type === 'notification';
    
        return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            layout
            className={cn("transition-opacity duration-300 w-full", isNotification && "text-center")}
          >
            {isNotification ? (
              <p className="text-xs text-muted-foreground italic bg-black/20 rounded-full px-3 py-1 inline-block">
                {msg.content}
              </p>
            ) : (
              <div className="flex items-start gap-2 text-left bg-black/20 text-white p-2 rounded-lg max-w-sm md:max-w-md">
                <Avatar
                  className="h-6 w-6 cursor-pointer"
                  onClick={() => handleViewProfile(msg.senderId)}
                >
                  <AvatarImage src={msg.senderPhotoURL} />
                  <AvatarFallback className="text-xs">
                    {getInitials(msg.senderName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm">
                  <span
                    className={cn(
                      "font-bold cursor-pointer pr-2",
                      senderProfile?.colorfulName &&
                        "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                    )}
                    onClick={() => handleViewProfile(msg.senderId)}
                  >
                    {msg.senderName}:
                  </span>
                  <span className="break-words">{msg.content}</span>
                </div>
              </div>
            )}
          </motion.div>
        );
      };

  return (
    <>
      <ContactProfileSheet 
          isOpen={isContactSheetOpen} 
          onOpenChange={setContactSheetOpen}
          userProfile={viewedProfile}
      />
      <AlertDialog open={dialogState.isOpen} onOpenChange={(isOpen) => !isOpen && setDialogState({ isOpen: false, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.action === 'delete' ? 'This will permanently delete the room for everyone.' : 
               dialogState.action === 'kick' ? `Do you want to kick ${dialogState.targetMember ? memberProfiles[dialogState.targetMember.userId]?.displayName : 'this user'}?` :
               'You are about to leave the room.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (dialogState.action === 'delete') handleDeleteRoom();
                else if (dialogState.action === 'leave') handleLeaveRoom();
                else if (dialogState.action === 'kick') handleKickUser(dialogState.targetMember);
                setDialogState({ isOpen: false, action: null, targetMember: null });
              }}
              className={dialogState.action !== 'leave' ? "bg-destructive hover:bg-destructive/90" : ""}>
                Yes, {dialogState.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b p-3 bg-background shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className="h-10 w-10">
                <AvatarImage src={room.photoURL} />
                <AvatarFallback>{getInitials(room.name)}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
                <h1 className="truncate font-bold text-lg">{room.name}</h1>
                <p className="text-xs text-muted-foreground">{members.length} people here</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDialogState({ isOpen: true, action: 'delete'})} className="text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Room
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <Button variant="destructive" size="sm" onClick={() => setDialogState({isOpen: true, action: 'leave'})}>
              <PhoneOff className="mr-2 h-4 w-4" /> Leave
            </Button>
          </div>
        </header>
        
        <main className="flex-1 flex flex-col items-center overflow-hidden p-4 md:p-6 space-y-6">
             {/* Top Row: Owner and Super */}
            <div className="flex justify-center gap-x-4 md:gap-x-8">
                {renderSlot(OWNER_SLOT)}
                {renderSlot(SUPER_ADMIN_SLOT)}
            </div>
            
            {/* Mic Slots - First Row */}
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:gap-x-8">
                {Array.from({ length: 4 }).map((_, i) => renderSlot(i + 1))}
            </div>

             {/* Mic Slots - Second Row */}
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:gap-x-8">
                {Array.from({ length: 4 }).map((_, i) => renderSlot(i + 5))}
            </div>

            {/* Chat Area */}
            <div className="w-full flex-1 flex flex-col-reverse items-start gap-2 overflow-y-auto overflow-x-hidden p-2 rounded-lg bg-black/10">
                <AnimatePresence>
                    {messages.slice().reverse().map((msg, index) => renderMessage(msg, index))}
                </AnimatePresence>
            </div>
        </main>
        
        <footer className="shrink-0 border-t bg-background p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <Input 
                    placeholder="Type a message..."
                    className="pr-10"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={handleSendMessage}>
                    <Send className="h-5 w-5" />
                </Button>
            </div>
            <Button variant={isMuted ? 'destructive' : 'secondary'} size="icon" onClick={handleToggleMute}>
                {isMuted ? <MicOff /> : <Mic />}
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setIsDeafened(!isDeafened)}>
                {isDeafened ? <VolumeX /> : <Volume2 />}
            </Button>
             <Button variant="secondary" size="icon" className="relative" asChild>
                <Link href="/chat">
                    <Inbox />
                    {inboxCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{inboxCount}</Badge>
                    )}
                </Link>
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}
