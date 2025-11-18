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
  Settings,
  UserPlus,
  ArrowDownToLine,
  LogOut,
  Armchair,
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
  DropdownMenuSeparator,
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
import { RoomSettingsSheet } from '@/components/chat/room-settings-sheet';
import { InviteFriendsSheet } from '@/components/chat/invite-friends-sheet';
import { ExitRoomDialog } from '@/components/chat/exit-room-dialog';


const MIC_SLOTS = 8;
const SUPER_ADMIN_SLOT = -1;
const OWNER_SLOT = 0;
const GURIA_SLOT = -2; // New special slot

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
  const [isSettingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [isInviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<'joining' | 'joined' | 'leaving' | 'error'>('joining');


  const [dialogState, setDialogState] = useState<{ isOpen: boolean, action: 'delete' | 'leave' | 'kick' | 'exit' | null, targetMember?: RoomMember | null }>({ isOpen: false, action: null });
  
  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserSlot = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);
  const isMuted = useMemo(() => currentUserSlot?.isMuted ?? false, [currentUserSlot]);
  
  const handleLeaveRoom = useCallback(async (isKickOrDelete = false) => {
    if (!firestore || !authUser || status === 'leaving') return;

    setStatus('leaving');
    contextLeaveRoom(); 

    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    const roomRef = doc(firestore, 'rooms', roomId);
    const userRef = doc(firestore, 'users', authUser.uid);

    try {
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists()) {
            const batch = writeBatch(firestore);
            batch.delete(memberRef);
            
            if (memberDoc.data().micSlot > 0 && !isKickOrDelete) { 
                const roomDoc = await getDoc(roomRef);
                if (roomDoc.exists() && roomDoc.data().memberCount > 0) {
                  batch.update(roomRef, { memberCount: increment(-1) });
                }
            }
            
            batch.update(userRef, { currentRoomId: null });
            await batch.commit();
        }
    } catch(e) {
        console.warn("Could not leave room properly, room might be deleted.", e);
    }
    router.push('/chat/rooms');
  }, [firestore, authUser, roomId, router, contextLeaveRoom, status]);
  
  const handleMinimizeRoom = useCallback(() => {
    router.push('/chat/rooms');
  }, [router]);
  
  useEffect(() => {
    if (!firestore || !roomId || !authUser?.uid) return;

    let unsubRoom: (() => void) | undefined;
    let unsubMembers: (() => void) | undefined;
    let unsubMessages: (() => void) | undefined;

    const joinAndListen = async () => {
      const roomRef = doc(firestore, 'rooms', roomId);
      const userRef = doc(firestore, 'users', authUser.uid);
      const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);

      try {
        // 1. Check if room exists and user is not kicked
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
          toast({ title: 'Room not found', variant: 'destructive' });
          router.push('/chat/rooms');
          return;
        }

        const roomData = roomSnap.data() as Room;
        if (roomData.kickedUsers?.[authUser.uid]) {
          toast({ title: "Cannot Join", description: "You have been kicked from this room.", variant: "destructive" });
          router.push('/chat/rooms');
          return;
        }
        
        // 2. Add/update user as a member IN A SINGLE STEP
        const isRoomOwner = roomData.ownerId === authUser.uid;
        await setDoc(memberRef, {
            userId: authUser.uid,
            isMuted: true,
            micSlot: isRoomOwner ? OWNER_SLOT : null
        }, { merge: true });
        
        // 3. Update user's current room
        await updateDoc(userRef, { currentRoomId: roomId });


        // 4. Setup Listeners
        unsubRoom = onSnapshot(roomRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedRoomData = { id: docSnap.id, ...docSnap.data() } as Room;
            setRoom(updatedRoomData);
            setCurrentRoom(updatedRoomData);
            if (updatedRoomData.kickedUsers?.[authUser.uid]) {
              toast({ title: "You've been kicked", variant: 'destructive' });
              handleLeaveRoom(true);
            }
          } else {
            toast({ title: 'Room deleted', variant: 'destructive' });
            contextLeaveRoom();
            router.push('/chat/rooms');
          }
        });

        const membersQuery = query(collection(roomRef, 'members'));
        unsubMembers = onSnapshot(membersQuery, async (snapshot) => {
            const membersList = snapshot.docs.map(d => d.data() as RoomMember);
            
            const newMemberIds = membersList
                .map(m => m.userId)
                .filter(id => !memberProfiles[id]);

            if (newMemberIds.length > 0) {
                const profilesRef = collection(firestore, 'users');
                const newProfiles: Record<string, UserProfile> = {};
                for (let i = 0; i < newMemberIds.length; i += 30) {
                    const chunk = newMemberIds.slice(i, i + 30);
                    const profilesQuery = query(profilesRef, where('uid', 'in', chunk));
                    const profilesSnapshot = await getDocs(profilesQuery);
                    profilesSnapshot.forEach(doc => newProfiles[doc.id] = doc.data() as UserProfile);
                }
                setMemberProfiles(prev => ({...prev, ...newProfiles}));
            }
            
            setMembers(membersList);
        }, (error) => {
            console.error("Error listening to room members:", error);
        });
        
        setStatus('joined');

        const joinTime = Timestamp.now();
        const messagesQuery = query(collection(roomRef, 'messages'), where('timestamp', '>=', joinTime), orderBy('timestamp', 'asc'));
        unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const newMsg = { id: change.doc.id, ...change.doc.data() } as RoomMessage;
              setMessages(prev => [...prev, newMsg]);
            }
          });
        });

      } catch (error) {
        console.error("Error joining room:", error);
        setStatus('error');
        router.push('/chat/rooms');
      }
    };

    joinAndListen();

    return () => {
      unsubRoom?.();
      unsubMembers?.();
      unsubMessages?.();
    };
  }, [firestore, roomId, authUser?.uid]); // Removed dependencies causing re-runs

  const handleDeleteRoom = async () => {
     if (!firestore || !isOwner || !room) return;
    try {
        await deleteDoc(doc(firestore, 'rooms', room.id));
        toast({ title: 'Room Deleted', description: 'The room has been successfully deleted.' });
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
  
  const handleTakeSeat = async (slotNumber: number) => {
      if (!currentUserSlot || !authUser) return;
      
      const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
      await updateDoc(memberRef, { micSlot: slotNumber });
  };
        
  const handleLeaveSeat = async () => {
      if (!currentUserSlot || currentUserSlot.micSlot === null || !authUser) return;
      
      const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
      await updateDoc(memberRef, { micSlot: null });
  }

  if (status === 'joining' || !room || !authUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p>Joining room...</p>
      </div>
    );
  }
   if (status === 'leaving') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p>Leaving room...</p>
      </div>
    );
  }
    if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-destructive">Could not connect to the room.</p>
      </div>
    );
  }
  
    const renderSlot = (slotNumber: number) => {
        const memberInSlot = members.find(m => m.micSlot === slotNumber);
        const profile = memberInSlot ? memberProfiles[memberInSlot.userId] : null;
        
        const isLocked = room?.lockedSlots?.includes(slotNumber) || false;
        const isSelf = memberInSlot?.userId === authUser.uid;
        
        const isOwnerSlot = slotNumber === OWNER_SLOT;
        const isGuriaSlot = slotNumber === GURIA_SLOT;
        
        const canTakeSeat = !memberInSlot && !isLocked && (isOwner || currentUserSlot?.micSlot === null);

        const content = (
             <div className="relative flex flex-col items-center justify-center space-y-1 w-20 md:w-24">
                <div className="relative h-20 w-20 md:h-24 md:w-24">
                    <div className={cn("relative h-full w-full rounded-full flex items-center justify-center transition-all duration-200", 
                                      memberInSlot ? `ring-2 ring-offset-2 ring-offset-background ${room.theme ? `ring-[var(--theme-color)]` : 'ring-primary'}` : "border-2 border-dashed border-muted-foreground/50",
                                      memberInSlot && memberInSlot.isMuted && "ring-destructive",
                                      isSelf && !isMuted && "talking-indicator",
                                      isLocked ? 'bg-muted/50' : 'bg-muted'
                                      )}>
                        {profile ? (
                            <>
                                <Avatar className="h-full w-full">
                                    <AvatarImage src={profile.photoURL} />
                                    <AvatarFallback className="text-2xl">{getInitials(profile.displayName)}</AvatarFallback>
                                </Avatar>
                                {profile.officialBadge?.isOfficial && (
                                    <div className="absolute -top-1 -right-1">
                                        <OfficialBadge color={profile.officialBadge.badgeColor} size="icon" className="h-6 w-6" isOwner={profile.canManageOfficials}/>
                                    </div>
                                )}
                            </>
                        ) : isLocked ? (
                             <Lock className="text-muted-foreground h-8 w-8" />
                        ) : (
                           <Mic className="text-muted-foreground h-8 w-8"/>
                        )}
                        
                        {memberInSlot && memberInSlot.isMuted && <div className="absolute bottom-0 right-0 bg-destructive rounded-full p-1"><MicOff className="h-3 w-3 text-white"/></div>}

                    </div>
                </div>
                 <div className="h-5 flex items-center justify-center text-center">
                    {profile ? (
                        <div className="flex items-center gap-1.5">
                            <div className="text-sm font-medium truncate max-w-[80px]">
                                {applyNameColor(profile.displayName.split(' ')[0], profile.nameColor)}
                            </div>
                            {profile.verifiedBadge?.showBadge && (
                                <VerifiedBadge color={profile.verifiedBadge.badgeColor} className="h-4 w-4"/>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {isOwnerSlot ? 'UMAR BHAI' : isGuriaSlot ? 'GURIA' : slotNumber > 0 ? slotNumber : ''}
                        </p>
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
                    {memberInSlot && (
                        <DropdownMenuItem onClick={() => handleViewProfile(memberInSlot.userId)}>
                            <View className="mr-2 h-4 w-4"/> View Profile
                        </DropdownMenuItem>
                    )}

                    {isOwner && memberInSlot && !isSelf && (
                        <>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem onClick={() => setDialogState({ isOpen: true, action: 'kick', targetMember: memberInSlot })} className="text-destructive focus:text-destructive">
                                <UserX className="mr-2 h-4 w-4"/> Kick User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleForceLeaveMic(memberInSlot)}>
                                <MicOff className="mr-2 h-4 w-4" /> Move from Mic
                            </DropdownMenuItem>
                        </>
                    )}
                    
                   {isOwner && !memberInSlot && (
                       <DropdownMenuItem onClick={() => handleToggleLock(slotNumber)}>
                            {isLocked ? <Unlock className="mr-2 h-4 w-4"/> : <Lock className="mr-2 h-4 w-4"/>}
                            {isLocked ? 'Unlock Mic' : 'Lock Mic'}
                        </DropdownMenuItem>
                   )}
                    
                    {canTakeSeat && (
                        <DropdownMenuItem onClick={() => handleTakeSeat(slotNumber)}>
                            <Armchair className="mr-2 h-4 w-4"/> Take Seat
                        </DropdownMenuItem>
                    )}
                    
                    {(isSelf && currentUserSlot?.micSlot !== null && !isOwnerSlot && !isGuriaSlot) && (
                         <DropdownMenuItem onClick={handleLeaveSeat}>
                            <Armchair className="mr-2 h-4 w-4 text-destructive"/> Leave Seat
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
                  <div
                    className="font-bold cursor-pointer pr-2 inline-flex items-center gap-1.5"
                    onClick={() => handleViewProfile(msg.senderId)}
                  >
                    <span>{applyNameColor(senderProfile?.displayName, senderProfile?.nameColor)}</span>
                     {senderProfile?.verifiedBadge?.showBadge && (
                        <VerifiedBadge color={senderProfile.verifiedBadge.badgeColor} className="h-4 w-4"/>
                    )}
                    {senderProfile?.officialBadge?.isOfficial && (
                        <OfficialBadge color={senderProfile.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={senderProfile.canManageOfficials}/>
                    )}
                  </div>
                  <span className="break-words">: {msg.content}</span>
                </div>
              </div>
            )}
          </motion.div>
        );
      };

    const themeStyle = room?.theme ? { '--theme-color': `var(--theme-${room.theme})` } as React.CSSProperties : {};
    const themeClass = room?.theme ? `theme-${room.theme}` : '';

  return (
    <>
      <ContactProfileSheet 
          isOpen={isContactSheetOpen} 
          onOpenChange={setContactSheetOpen}
          userProfile={viewedProfile}
      />
       <RoomSettingsSheet
        isOpen={isSettingsSheetOpen}
        onOpenChange={setSettingsSheetOpen}
        room={room}
        isOwner={isOwner}
      />
      <InviteFriendsSheet
        isOpen={isInviteSheetOpen}
        onOpenChange={setInviteSheetOpen}
        room={room}
      />
      <AlertDialog open={dialogState.isOpen && dialogState.action !== 'exit'} onOpenChange={(isOpen) => !isOpen && setDialogState({ isOpen: false, action: null })}>
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
                else if (dialogState.action === 'kick') handleKickUser(dialogState.targetMember);
                setDialogState({ isOpen: false, action: null, targetMember: null });
              }}
              className={dialogState.action !== 'leave' ? "bg-destructive hover:bg-destructive/90" : ""}>
                Yes, {dialogState.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExitRoomDialog
        isOpen={dialogState.isOpen && dialogState.action === 'exit'}
        onOpenChange={(isOpen) => !isOpen && setDialogState({ isOpen: false, action: null })}
        onLeave={() => {
          handleLeaveRoom();
          setDialogState({ isOpen: false, action: null });
        }}
        onMinimize={() => {
          handleMinimizeRoom();
          setDialogState({ isOpen: false, action: null });
        }}
      />

      <div className={cn("flex h-screen flex-col", themeClass)} style={themeStyle}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b p-3 bg-background shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className="h-10 w-10">
                <AvatarImage src={room.photoURL} />
                <AvatarFallback>{getInitials(room.name)}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
                <h1 className="truncate font-bold text-lg">{room.name}</h1>
                <p className="text-xs text-muted-foreground">{members.length || 0} people here</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setInviteSheetOpen(true)}>
              <UserPlus className="h-5 w-5" />
            </Button>
            {isOwner && (
                <Button variant="ghost" size="icon" onClick={() => setSettingsSheetOpen(true)}>
                    <Settings className="h-5 w-5" />
                </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => setDialogState({isOpen: true, action: 'exit'})}>
              <LogOut className="mr-2 h-4 w-4" /> Exit
            </Button>
          </div>
        </header>
        
        <main className="flex-1 flex flex-col items-center overflow-hidden p-4 md:p-6 space-y-4">
             <div className="flex justify-center gap-x-4 md:gap-x-8">
                {renderSlot(OWNER_SLOT)}
                {renderSlot(GURIA_SLOT)}
            </div>

            <div className="w-full max-w-4xl space-y-4">
                 <div className="flex justify-center gap-4">
                    {Array.from({ length: 4 }).map((_, i) => renderSlot(i + 1))}
                </div>
                <div className="flex justify-center gap-4">
                    {Array.from({ length: 4 }).map((_, i) => renderSlot(i + 5))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="w-full flex-1 flex flex-col-reverse items-start gap-2 overflow-y-auto overflow-x-hidden p-2 rounded-lg">
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
