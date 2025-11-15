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
  Shield,
  Trash2,
  Unlock,
  UserX,
  Volume2,
  VolumeX,
  PhoneOff,
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
  const [isDeafened, setIsDeafened] = useState(false);

  const [dialogState, setDialogState] = useState<{ isOpen: boolean, action: 'delete' | 'leave' | 'kick', targetMember?: RoomMember | null }>({ isOpen: false, action: null });
  
  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserSlot = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);

  useEffect(() => {
    setIsMounted(true);
    if (!firestore || !roomId || !authUser) return;

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
    });

    const membersRef = collection(firestore, 'rooms', roomId, 'members');
    const qMembers = query(membersRef);
    const unsubMembers = onSnapshot(qMembers, async (snapshot) => {
        const membersList = snapshot.docs.map(d => d.data() as RoomMember);
        setMembers(membersList);

        const newMemberIds = membersList.map(m => m.userId).filter(id => !memberProfiles[id]);
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
      contextLeaveRoom();
    };
  }, [firestore, roomId, authUser, toast, router, setCurrentRoom, contextLeaveRoom]);

   useEffect(() => {
    if (!firestore || !authUser || !room || !isMounted) return;

    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    const roomRef = doc(firestore, 'rooms', roomId);

    const joinRoom = async () => {
        const memberDoc = await getDoc(memberRef);
        if (!memberDoc.exists()) {
            let initialMicSlot = null;
            if (isOwner) {
                initialMicSlot = 0;
            }
            await writeBatch(firestore)
                .set(memberRef, { userId: authUser.uid, micSlot: initialMicSlot, isMuted: false })
                .update(roomRef, { memberCount: increment(1) })
                .commit();
        }
    };
    joinRoom();

    return () => {
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
                console.warn("Could not update member count on leave, room might be deleted.", e);
             }
        }
      };
      leave();
    };
  }, [firestore, authUser, roomId, room, isMounted, isOwner]);


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
  
  const handleKickUser = async (targetMember?: RoomMember | null) => {
    if (!firestore || !isOwner || !targetMember || targetMember.userId === authUser?.uid) return;
    const roomRef = doc(firestore, 'rooms', roomId);
    await updateDoc(roomRef, { [`kickedUsers.${targetMember.userId}`]: serverTimestamp() });
    setDialogState({ isOpen: false, action: null });
  };
  
  const handleToggleMute = async () => {
    if (!firestore || !authUser || !currentUserSlot) return;
    const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
    await updateDoc(memberRef, { isMuted: !currentUserSlot.isMuted });
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
  
  const ownerMember = useMemo(() => members.find(m => m.micSlot === 0), [members]);

  if (!room || !authUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <p>Joining room...</p>
      </div>
    );
  }
  
  const renderSlot = (slotNumber: number) => {
      const memberInSlot = members.find(m => m.micSlot === slotNumber);
      const profile = memberInSlot ? memberProfiles[memberInSlot.userId] : null;

      const handleSlotClick = async () => {
          if (!memberInSlot) {
              if (isOwner || !room.lockedSlots?.includes(slotNumber)) {
                  const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
                  await updateDoc(memberRef, { micSlot: slotNumber });
              } else {
                  toast({ title: 'Slot Locked', description: 'This slot is locked by the owner.' });
              }
          } else if (memberInSlot.userId === authUser.uid) {
              const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
              await updateDoc(memberRef, { micSlot: null });
          } else if (isOwner) {
              setDialogState({ isOpen: true, action: 'kick', targetMember: memberInSlot });
          }
      };
      
      const handleToggleLock = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOwner) return;
        const roomRef = doc(firestore, 'rooms', roomId);
        const isLocked = room.lockedSlots?.includes(slotNumber);
        if (isLocked) {
            await updateDoc(roomRef, { lockedSlots: arrayRemove(slotNumber) });
        } else {
            await updateDoc(roomRef, { lockedSlots: arrayUnion(slotNumber) });
        }
      };

      return (
          <div key={slotNumber} className="relative flex flex-col items-center justify-center space-y-1" onClick={handleSlotClick}>
              <button className={cn("relative h-20 w-20 rounded-full bg-muted flex items-center justify-center transition-all duration-200", 
                                  memberInSlot ? "ring-2 ring-offset-2 ring-offset-background" : "border-2 border-dashed border-muted-foreground/50",
                                  memberInSlot && memberInSlot.isMuted ? "ring-destructive" : "ring-primary")}>
                  {profile ? (
                      <Avatar className="h-full w-full">
                          <AvatarImage src={profile.photoURL} />
                          <AvatarFallback className="text-2xl">{getInitials(profile.displayName)}</AvatarFallback>
                      </Avatar>
                  ) : room.lockedSlots?.includes(slotNumber) ? (
                      <Lock className="h-8 w-8 text-muted-foreground"/>
                  ) : (
                      <Mic className="h-8 w-8 text-muted-foreground"/>
                  )}
                  
                  {memberInSlot && memberInSlot.isMuted && <div className="absolute bottom-0 right-0 bg-destructive rounded-full p-1"><MicOff className="h-3 w-3 text-white"/></div>}
              </button>
              {profile && <p className="text-sm font-medium truncate max-w-[80px]">{profile.displayName}</p>}
               {isOwner && !memberInSlot && (
                    <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={handleToggleLock}>
                        {room.lockedSlots?.includes(slotNumber) ? <Unlock className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                )}
          </div>
      )
  }

  return (
    <>
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
            {/* Owner Slot */}
            <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative">
                    <button className={cn("relative h-28 w-28 rounded-full bg-muted flex items-center justify-center transition-all duration-200 ring-2 ring-offset-4 ring-offset-background", ownerMember && ownerMember.isMuted ? "ring-destructive" : "ring-yellow-500")}>
                        {ownerMember && memberProfiles[ownerMember.userId] ? (
                            <Avatar className="h-full w-full">
                                <AvatarImage src={memberProfiles[ownerMember.userId].photoURL} />
                                <AvatarFallback className="text-4xl">{getInitials(memberProfiles[ownerMember.userId].displayName)}</AvatarFallback>
                            </Avatar>
                        ) : (
                            <Crown className="h-12 w-12 text-yellow-500"/>
                        )}
                    </button>
                    <Crown className="absolute -top-2 -right-2 h-8 w-8 text-yellow-500 bg-background rounded-full p-1 border-2 border-yellow-500"/>
                </div>
                {ownerMember && memberProfiles[ownerMember.userId] && <p className="font-bold text-lg">{memberProfiles[ownerMember.userId].displayName}</p>}
                <p className="text-sm text-yellow-500 font-semibold">OWNER</p>
            </div>

            {/* Member Slots */}
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:gap-x-8">
                {Array.from({ length: MIC_SLOTS }).map((_, i) => renderSlot(i + 1))}
            </div>
        </div>

        <footer className="shrink-0 border-t bg-background p-3 space-y-3">
             <div className="flex justify-center items-center gap-4">
                 <Button variant={currentUserSlot?.isMuted ? 'destructive' : 'secondary'} size="lg" className="rounded-full h-14 w-14" onClick={handleToggleMute}>
                    {currentUserSlot?.isMuted ? <MicOff className="h-6 w-6"/> : <Mic className="h-6 w-6"/>}
                </Button>
                 <Button variant={isDeafened ? 'destructive' : 'secondary'} size="lg" className="rounded-full h-14 w-14" onClick={() => setIsDeafened(!isDeafened)}>
                    {isDeafened ? <VolumeX className="h-6 w-6"/> : <Volume2 className="h-6 w-6"/>}
                </Button>
            </div>
            <div className="relative">
                <Input 
                    placeholder="Send a message..." 
                    className="pr-10"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleSendMessage}>
                    <Send className="h-5 w-5"/>
                </Button>
            </div>
        </footer>
      </div>
    </>
  );
}
