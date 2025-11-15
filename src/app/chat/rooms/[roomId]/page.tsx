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
  Trash2,
  Unlock,
  UserX,
  Volume2,
  VolumeX,
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


const MIC_SLOTS = 8;

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setCurrentRoom, leaveCurrentRoom: contextLeaveRoom } = useRoomContext();
  const [isMounted, setIsMounted] = useState(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [message, setMessage] = useState('');

  const [isMuted, setIsMuted] = useState(false);
  const [dialogState, setDialogState] = useState<{ isOpen: boolean, action: 'delete' | 'leave' | null }>({ isOpen: false, action: null });
  
  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserSlot = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);

  // --- Real-time Listeners ---

  // Room, Members, and Messages Listener
  useEffect(() => {
    setIsMounted(true);
    if (!firestore || !roomId || !authUser) return;

    // Room listener
    const roomRef = doc(firestore, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as Room;
        setRoom(roomData);
        setCurrentRoom(roomData); // Update context
        // Check if user was kicked
        if (roomData.kickedUsers && roomData.kickedUsers[authUser.uid]) {
            toast({ title: "You've been kicked", description: "You have been removed from this room by the owner.", variant: 'destructive'});
            router.push('/chat/rooms');
        }
      } else {
        toast({ title: 'Room not found', description: 'This room may have been deleted.', variant: 'destructive' });
        router.push('/chat/rooms');
      }
    });

    // Members listener
    const membersRef = collection(firestore, 'rooms', roomId, 'members');
    const qMembers = query(membersRef);
    const unsubMembers = onSnapshot(qMembers, async (snapshot) => {
        const membersList = snapshot.docs.map(d => d.data() as RoomMember);
        setMembers(membersList);

        // Fetch profiles for new members
        const newMemberIds = membersList
            .map(m => m.userId)
            .filter(id => !memberProfiles[id]);

        if (newMemberIds.length > 0) {
            const profilesRef = collection(firestore, 'users');
            const profilesQuery = query(profilesRef, where('uid', 'in', newMemberIds));
            const profilesSnapshot = await getDocs(profilesQuery);
            const newProfiles: Record<string, UserProfile> = {};
            profilesSnapshot.forEach(doc => {
                newProfiles[doc.id] = doc.data() as UserProfile;
            });
            setMemberProfiles(prev => ({...prev, ...newProfiles}));
        }
    });

    // Messages listener
    const messagesRef = collection(firestore, 'rooms', roomId, 'messages');
    const qMessages = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
        const msgs = snapshot.docs.map(d => ({id: d.id, ...d.data()} as RoomMessage)).reverse();
        setMessages(msgs);
    });

    return () => {
      unsubRoom();
      unsubMembers();
      unsubMessages();
      contextLeaveRoom(); // Clear context on unmount
    };
  }, [firestore, roomId, authUser, toast, router, setCurrentRoom, contextLeaveRoom]);

  // Join/Leave logic
   useEffect(() => {
    if (!firestore || !authUser || !room || !isMounted) return;

    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    const roomRef = doc(firestore, 'rooms', roomId);

    const joinRoom = async () => {
        const memberDoc = await getDoc(memberRef);
        if (!memberDoc.exists()) {
            await writeBatch(firestore)
                .set(memberRef, { userId: authUser.uid, micSlot: null, isMuted: false })
                .update(roomRef, { memberCount: increment(1) })
                .commit();
        }
    };

    joinRoom();

    return () => {
      // This is the cleanup function that runs when the component unmounts
      const leave = async () => {
        if (firestore && authUser && roomId) {
            const memberRefOnLeave = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
            const roomRefOnLeave = doc(firestore, 'rooms', roomId);
             try {
                await writeBatch(firestore)
                    .delete(memberRefOnLeave)
                    .update(roomRefOnLeave, { memberCount: increment(-1) })
                    .commit();
             } catch(e) {
                // This can fail if the room is deleted before the user leaves, which is fine.
                console.warn("Could not update member count on leave, room might be deleted.", e);
             }
        }
      };
      leave();
    };
  }, [firestore, authUser, roomId, room, isMounted]);

  // --- Handlers ---
  const handleLeaveRoom = async () => {
    router.push('/chat/rooms');
  };

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
  
  const handleToggleMute = async (targetMember: RoomMember) => {
    if (!firestore || !isOwner || targetMember.userId === authUser?.uid) return;
    const memberRef = doc(firestore, 'rooms', roomId, 'members', targetMember.userId);
    await updateDoc(memberRef, { isMuted: !targetMember.isMuted });
  };
  
  const handleKickUser = async (targetMember: RoomMember) => {
    if (!firestore || !isOwner || targetMember.userId === authUser?.uid) return;
    
    const roomRef = doc(firestore, 'rooms', roomId);
    await updateDoc(roomRef, {
        [`kickedUsers.${targetMember.userId}`]: serverTimestamp()
    });
    // The user will be automatically redirected by the useEffect listener
  };

  const handleMicSlotClick = async (slotNumber: number) => {
      if (!firestore || !authUser || !room) return;
      if (room.lockedSlots?.includes(slotNumber) && !isOwner) {
          toast({ title: 'Slot Locked', description: 'The owner has locked this slot.'});
          return;
      }

      const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
      const currentMemberData = members.find(m => m.userId === authUser.uid);

      if (currentMemberData?.micSlot === slotNumber) {
          // User is clicking their own slot, so leave it
          await updateDoc(memberRef, { micSlot: null });
      } else {
          // User is taking a new slot
          await updateDoc(memberRef, { micSlot: slotNumber });
      }
  };

  const handleToggleLockSlot = async (slotNumber: number) => {
      if (!firestore || !room || !isOwner) return;
      const roomRef = doc(firestore, 'rooms', roomId);
      const isLocked = room.lockedSlots?.includes(slotNumber);

      if (isLocked) {
          await updateDoc(roomRef, { lockedSlots: arrayRemove(slotNumber) });
      } else {
          await updateDoc(roomRef, { lockedSlots: arrayUnion(slotNumber) });
      }
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
  
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  if (!room || !authUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Joining room...</p>
      </div>
    );
  }
  
  return (
    <>
      <AlertDialog open={dialogState.isOpen} onOpenChange={(isOpen) => !isOpen && setDialogState({ isOpen: false, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.action === 'delete'
                ? 'This will permanently delete the room for everyone. This action cannot be undone.'
                : 'You are about to leave the room.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={dialogState.action === 'delete' ? handleDeleteRoom : handleLeaveRoom} className={dialogState.action === 'delete' ? "bg-destructive hover:bg-destructive/90" : ""}>
                Yes, {dialogState.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex h-screen flex-col bg-muted/20">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 border-b p-4 bg-background">
          <Button variant="ghost" size="icon" onClick={() => setDialogState({ isOpen: true, action: 'leave' })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar>
                <AvatarImage src={room.photoURL} />
                <AvatarFallback>{getInitials(room.name)}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
                <h1 className="truncate font-bold text-lg">{room.name}</h1>
                <p className="text-sm text-muted-foreground">{members.length} people here</p>
            </div>
          </div>
          {isOwner && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDialogState({ isOpen: true, action: 'delete'})} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Room</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        
        {/* Main Content (Mic Slots and Chat) */}
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
            {/* Mic Slots */}
            <div className="flex-1 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Owner Slot */}
                    <div className="relative flex flex-col items-center justify-center space-y-2 p-4 rounded-lg bg-background shadow-sm border-2 border-yellow-500">
                        <Crown className="absolute top-2 right-2 h-5 w-5 text-yellow-500"/>
                        <Avatar className={cn("h-20 w-20", currentUserSlot?.isMuted && "ring-2 ring-destructive ring-offset-2")}>
                            <AvatarImage src={memberProfiles[room.ownerId]?.photoURL} />
                            <AvatarFallback className="text-2xl">{getInitials(memberProfiles[room.ownerId]?.displayName || '?')}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold text-center truncate w-full">{memberProfiles[room.ownerId]?.displayName}</p>
                    </div>

                    {/* Member Slots */}
                    {Array.from({ length: MIC_SLOTS }).map((_, i) => {
                        const slotNumber = i + 1;
                        const memberInSlot = members.find(m => m.micSlot === slotNumber);
                        const profile = memberInSlot ? memberProfiles[memberInSlot.userId] : null;
                        const isLocked = room.lockedSlots?.includes(slotNumber);

                        return (
                            <div key={slotNumber} className="relative flex flex-col items-center justify-center space-y-2 p-4 rounded-lg bg-background shadow-sm h-40">
                                {memberInSlot ? (
                                    <>
                                        <Avatar className={cn("h-16 w-16 md:h-20 md:w-20", memberInSlot.isMuted && "ring-2 ring-destructive ring-offset-2")}>
                                            <AvatarImage src={profile?.photoURL} />
                                            <AvatarFallback className="text-2xl">{getInitials(profile?.displayName || '?')}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex items-center gap-1">
                                            {profile?.officialBadge?.isOfficial && <OfficialBadge color={profile.officialBadge.badgeColor} size="icon" className="h-4 w-4"/>}
                                            <p className="font-semibold text-center truncate max-w-[100px]">{profile?.displayName}</p>
                                        </div>
                                         {isOwner && memberInSlot.userId !== authUser.uid && (
                                            <div className="absolute top-1 right-1 flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleToggleMute(memberInSlot)}>
                                                    {memberInSlot.isMuted ? <Volume2 className="h-4 w-4"/> : <VolumeX className="h-4 w-4"/>}
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleKickUser(memberInSlot)}>
                                                    <UserX className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <button 
                                        className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:bg-muted/50 rounded-lg disabled:cursor-not-allowed"
                                        onClick={() => handleMicSlotClick(slotNumber)}
                                        disabled={isLocked && !isOwner}
                                    >
                                        {isLocked ? <Lock className="h-8 w-8"/> : <Mic className="h-8 w-8"/>}
                                        <span className="text-sm mt-2">{isLocked ? 'Locked' : `Slot ${slotNumber}`}</span>
                                    </button>
                                )}
                                {isOwner && (
                                    <Button size="icon" variant="ghost" className="absolute bottom-1 right-1 h-6 w-6" onClick={() => handleToggleLockSlot(slotNumber)}>
                                        {isLocked ? <Unlock className="h-4 w-4 text-primary"/> : <Lock className="h-4 w-4"/>}
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chat */}
            <div className="flex flex-col w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l bg-background">
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                         {messages.map(msg => (
                            <div key={msg.id} className="flex items-start gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={msg.senderPhotoURL} />
                                    <AvatarFallback>{getInitials(msg.senderName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-semibold">{msg.senderName}</p>
                                    <div className="text-sm bg-muted rounded-lg p-2 mt-1">
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                         ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t">
                    <div className="relative">
                        <Input 
                            placeholder="Send a message..." 
                            className="pr-16"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                            <Button variant="ghost" size="icon">
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleSendMessage}>
                                <Send className="h-5 w-5"/>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}
