'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'firebase/firestore';
import {
  ArrowLeft,
  Crown,
  DoorOpen,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
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


const MIC_SLOTS = 8;
const SUPER_ADMIN_SLOT = -1;
const OWNER_SLOT = 0;

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setCurrentRoom, leaveCurrentRoom: contextLeaveRoom } = useRoomContext();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [message, setMessage] = useState('');
  
  const [isDeafened, setIsDeafened] = useState(false);
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);

  const [dialogState, setDialogState] = useState<{ isOpen: boolean, action: 'delete' | 'leave' | 'kick', targetMember?: RoomMember | null }>({ isOpen: false, action: null });
  
  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserSlot = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);
  const isMuted = useMemo(() => currentUserSlot?.isMuted ?? false, [currentUserSlot]);

  // --- Main Data Fetching and Room Joining Logic ---
  useEffect(() => {
    if (!firestore || !roomId || !authUser) return;

    // Listener for the main room document
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

    // Listener for the members subcollection
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

    // Listener for messages
    const messagesRef = collection(firestore, 'rooms', roomId, 'messages');
    const qMessages = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
        const msgs = snapshot.docs.map(d => ({id: d.id, ...d.data()} as RoomMessage)).reverse();
        setMessages(msgs);
    });

    // Join room logic
    const joinRoom = async () => {
        const userProfileDoc = await getDoc(doc(firestore, 'users', authUser.uid));
        if (!userProfileDoc.exists()) return;
        const userProfile = userProfileDoc.data() as UserProfile;

        const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
        const roomRef = doc(firestore, 'rooms', roomId);
        
        const memberDoc = await getDoc(memberRef);
        const currentRoomData = (await getDoc(roomRef)).data() as Room;
        
        let initialMicSlot: number | null = null;
        if (currentRoomData.ownerId === authUser.uid) {
            initialMicSlot = OWNER_SLOT;
        } else if (userProfile?.officialBadge?.isOfficial) {
            initialMicSlot = SUPER_ADMIN_SLOT;
        }

        if (!memberDoc.exists()) {
            const batch = writeBatch(firestore);
            const memberData = { userId: authUser.uid, micSlot: initialMicSlot, isMuted: true };
            batch.set(memberRef, memberData);
            batch.update(roomRef, { memberCount: increment(1) });
            
            const notificationMessage = {
                senderId: 'system',
                senderName: 'System',
                senderPhotoURL: '',
                content: `${userProfile.displayName} joined the room.`,
                timestamp: serverTimestamp(),
                type: 'notification' as const,
            };
            const messageDocRef = doc(collection(firestore, 'rooms', roomId, 'messages'));
            batch.set(messageDocRef, notificationMessage);
            
            await batch.commit();
        } else {
            const currentMemberData = memberDoc.data() as RoomMember;
             if (currentRoomData.ownerId === authUser.uid && currentMemberData.micSlot !== OWNER_SLOT) {
                await updateDoc(memberRef, { micSlot: OWNER_SLOT });
            }
        }
    };
    
    joinRoom();

    // Cleanup listeners on component unmount
    return () => {
      unsubRoom();
      unsubMembers();
      unsubMessages();
      contextLeaveRoom();
    };
  }, [firestore, roomId, authUser?.uid]);

  // --- User Actions ---
  
  const handleLeaveRoom = useCallback(async (isKickOrDelete = false) => {
    if (!firestore || !authUser) return;

    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    const roomRef = doc(firestore, 'rooms', roomId);

    try {
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists()) {
            const batch = writeBatch(firestore);
            batch.delete(memberRef);
            // Only decrement count if not part of a room deletion
            if (!isKickOrDelete) { 
                batch.update(roomRef, { memberCount: increment(-1) });
            }
            await batch.commit();
        }
    } catch(e) {
        console.warn("Could not leave room properly, room might be deleted.", e);
    }
    router.push('/chat/rooms');
  }, [firestore, authUser, roomId, router]);

  const handleDeleteRoom = async () => {
     if (!firestore || !isOwner || !room) return;
    try {
        // First, signal to handleLeave that this is part of a delete operation
        await handleLeaveRoom(true); 
        await deleteDoc(doc(firestore, 'rooms', room.id));
        toast({ title: 'Room Deleted', description: 'The room has been successfully deleted.' });
        // router push is handled in handleLeaveRoom
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
    setDialogState({ isOpen: false, action: null });
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
  
  const handleViewProfile = (profile: UserProfile) => {
    setViewedProfile(profile);
    setContactSheetOpen(true);
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


  if (!room || !authUser || !currentUserSlot) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <p>Joining room...</p>
      </div>
    );
  }
  
    const renderSlot = (slotNumber: number, isSpecial: boolean = false, specialLabel?: string) => {
        const memberInSlot = members.find(m => m.micSlot === slotNumber);
        const profile = memberInSlot ? memberProfiles[memberInSlot.userId] : null;
        
        const isLocked = !isSpecial && room?.lockedSlots?.includes(slotNumber);
        const isSelf = memberInSlot?.userId === authUser.uid;
        
        const handleTakeSeat = async () => {
            if (!currentUserSlot) return;
            const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
            await updateDoc(memberRef, { micSlot: slotNumber });
        };
        
        const handleLeaveSeat = async () => {
            if (!currentUserSlot) return;
            const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
            await updateDoc(memberRef, { micSlot: null });
        }
        
        const content = (
             <div
                className={cn("relative flex flex-col items-center justify-center space-y-1 group")}
            >
                <div className={cn("relative h-20 w-20 rounded-full bg-muted flex items-center justify-center transition-all duration-200", 
                                  memberInSlot ? "ring-2 ring-offset-2 ring-offset-background" : "border-2 border-dashed border-muted-foreground/50",
                                  memberInSlot && memberInSlot.isMuted ? "ring-destructive" : "ring-primary",
                                  isSelf && !isMuted && "talking-indicator",
                                  specialLabel === "OWNER" && "ring-yellow-500",
                                  specialLabel === "SUPER" && "ring-purple-500",
                                  isLocked && "bg-muted-foreground/20"
                                  )}>
                    {profile ? (
                        <Avatar className="h-full w-full">
                            <AvatarImage src={profile.photoURL} />
                            <AvatarFallback className="text-2xl">{getInitials(profile.displayName)}</AvatarFallback>
                        </Avatar>
                    ) : (
                         isLocked ? (
                            <Lock className="h-8 w-8 text-muted-foreground"/>
                        ) : (
                            !isSpecial && <Mic className={cn("text-muted-foreground h-8 w-8")}/>
                        )
                    )}
                    
                    {memberInSlot && memberInSlot.isMuted && <div className="absolute bottom-0 right-0 bg-destructive rounded-full p-1"><MicOff className="h-3 w-3 text-white"/></div>}
                     {isSpecial && specialLabel && (
                       <div className={cn("absolute -top-2 -right-2 h-8 w-8 bg-background rounded-full p-1 border-2 flex items-center justify-center",
                         specialLabel === "OWNER" ? "border-yellow-500" : "border-purple-500"
                       )}>
                         {specialLabel === "OWNER" ? <Crown className="h-5 w-5 text-yellow-500"/> : <Shield className="h-5 w-5 text-purple-500"/> }
                       </div>
                    )}
                </div>
                 <div className="h-5 flex items-center justify-center">
                    {profile ? (
                         <p className="text-sm font-medium truncate max-w-[80px] text-center">{profile.displayName}</p>
                    ) : specialLabel ? (
                        <p className={cn("text-sm font-semibold", specialLabel === "OWNER" ? "text-yellow-500" : "text-purple-500")}>{specialLabel}</p>
                    ) : (
                         !isLocked && <p className="text-sm text-muted-foreground">{slotNumber}</p>
                    )}
                </div>
            </div>
        )
        
        if (isSpecial) return <div key={specialLabel}>{content}</div>
        
        return (
            <DropdownMenu key={slotNumber}>
                <DropdownMenuTrigger asChild disabled={!!memberInSlot && memberInSlot.userId !== authUser?.uid && !isOwner}>
                    <div className="cursor-pointer">{content}</div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {isOwner && memberInSlot && !isSelf && (
                        <>
                           <DropdownMenuItem onClick={() => setDialogState({ isOpen: true, action: 'kick', targetMember: memberInSlot })}>
                                <UserX className="mr-2 h-4 w-4"/> Kick User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => profile && handleViewProfile(profile)}>
                                <View className="mr-2 h-4 w-4"/> View Profile
                            </DropdownMenuItem>
                        </>
                    )}
                    
                    {isOwner && !memberInSlot && (
                        <DropdownMenuItem onClick={() => handleToggleLock(slotNumber)}>
                            {isLocked ? <Unlock className="mr-2 h-4 w-4"/> : <Lock className="mr-2 h-4 w-4"/>}
                            {isLocked ? 'Unlock Mic' : 'Lock Mic'}
                        </DropdownMenuItem>
                    )}

                    {!memberInSlot && !isLocked && (
                         <DropdownMenuItem onClick={handleTakeSeat}>
                            <Mic className="mr-2 h-4 w-4"/> Take Seat
                         </DropdownMenuItem>
                    )}
                    
                    {isSelf && slotNumber === currentUserSlot?.micSlot && currentUserSlot.micSlot > 0 && (
                         <DropdownMenuItem onClick={handleLeaveSeat}>
                            <MicOff className="mr-2 h-4 w-4"/> Leave Seat
                         </DropdownMenuItem>
                    )}

                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

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
              }}
              className={dialogState.action !== 'leave' ? "bg-destructive hover:bg-destructive/90" : ""}>
                Yes, {dialogState.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
        <header className="flex items-center justify-between gap-4 border-b p-3 bg-background shadow-sm">
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
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex justify-center items-center gap-x-4">
                {renderSlot(OWNER_SLOT, true, "OWNER")}
                {renderSlot(SUPER_ADMIN_SLOT, true, "SUPER")}
            </div>

            <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:gap-x-8">
                {Array.from({ length: MIC_SLOTS }).map((_, i) => renderSlot(i + 1))}
            </div>

             <ScrollArea className="h-48 mt-4 rounded-md border p-2">
                 {messages.map((msg, index) => (
                    <div key={index} className={cn("p-2 text-sm", msg.type === 'notification' && "text-center text-xs text-muted-foreground")}>
                         {msg.type === 'notification' ? (
                            <p>{msg.content}</p>
                        ) : (
                             <p><span className="font-bold">{msg.senderName}:</span> {msg.content}</p>
                        )}
                    </div>
                ))}
             </ScrollArea>
        </div>

         <footer className="shrink-0 border-t bg-background p-3">
            <div className="relative flex items-center gap-2">
                 <Input 
                    placeholder="Send a message..." 
                    className="flex-1 pr-12"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button variant="ghost" size="icon" onClick={handleSendMessage}>
                    <Send className="h-5 w-5"/>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleToggleMute} disabled={currentUserSlot.micSlot === null}>
                    {isMuted ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
                </Button>
                 <Button variant="ghost" size="icon" onClick={() => setIsDeafened(!isDeafened)}>
                    {isDeafened ? <VolumeX className="h-5 w-5"/> : <Volume2 className="h-5 w-5"/>}
                </Button>
            </div>
        </footer>
      </div>
    </>
  );
}
