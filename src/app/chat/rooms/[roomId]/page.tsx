'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Crown,
  Shield,
  LogOut,
  Volume2,
  UserX,
  Send,
  Settings,
  Lock,
  LockOpen,
  UserPlus,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, updateDoc, deleteDoc, setDoc, getDoc, addDoc, serverTimestamp, query, orderBy, arrayUnion, arrayRemove, writeBatch, where, Timestamp } from 'firebase/firestore';
import type { Room, RoomMember, UserProfile, RoomMessage } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Textarea } from '@/components/ui/textarea';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { RoomInviteSheet } from '@/components/chat/room-invite-sheet';


const MicPlaceholder = ({ onSit, slotNumber, slotType, disabled, isOwner, onLockToggle, isLocked, onInvite }: { 
    onSit: (slot: number) => void; 
    slotNumber: number; 
    slotType?: 'owner' | 'super'; 
    disabled?: boolean;
    isOwner: boolean;
    onLockToggle: (slot: number) => void;
    isLocked: boolean;
    onInvite: (slot: number) => void;
}) => (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex flex-col items-center gap-2 text-center disabled:opacity-50" disabled={disabled && !isOwner}>
            <div className={cn("w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center border-2 border-dashed",
                slotType === 'owner' && 'border-yellow-500/50',
                slotType === 'super' && 'border-blue-500/50',
                !slotType && 'border-muted-foreground/30',
                isLocked && 'border-red-500/50'
            )}>
                 {isLocked ? (
                    <Lock className="w-8 h-8 text-red-500/50" />
                 ) : (
                    <Mic className="w-8 h-8 text-muted-foreground/30" />
                 )}
            </div>
             <p className="font-semibold text-sm text-muted-foreground/50 capitalize">
                {slotType ? slotType : slotNumber}
             </p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
         <div className="flex flex-col">
            <Button variant="ghost" onClick={() => onSit(slotNumber)} className="w-full justify-start px-4 py-2" disabled={isLocked && !isOwner}>
                <Mic className="mr-2 h-4 w-4"/> Take Seat
            </Button>
            {isOwner && (
                <>
                    <Button variant="ghost" onClick={() => onInvite(slotNumber)} className="w-full justify-start px-4 py-2">
                       <UserPlus className="mr-2 h-4 w-4"/> Invite
                    </Button>
                    <Button variant="ghost" onClick={() => onLockToggle(slotNumber)} className="w-full justify-start px-4 py-2">
                        {isLocked ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                        {isLocked ? 'Unlock' : 'Lock'}
                    </Button>
                </>
            )}
         </div>
      </PopoverContent>
    </Popover>
);

const UserMic = ({ member, userProfile, role, isOwner, isCurrentUser, onKick, onMuteToggle, onStandUp }: { 
    member: RoomMember | null;
    userProfile: UserProfile | null;
    role?: 'owner' | 'super' | 'member'; 
    isOwner: boolean;
    isCurrentUser: boolean;
    onKick: (userId: string) => void;
    onMuteToggle: (userId: string, isMuted: boolean) => void;
    onStandUp: () => void;
}) => {
    
    if (!userProfile || !member) return null;
    
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

    const canManage = isOwner && !isCurrentUser;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!canManage && !isCurrentUser}>
                 <div className="flex flex-col items-center gap-2 text-center cursor-pointer">
                    <div className="relative">
                        <Avatar className={cn("w-20 h-20 border-2", member.isMuted ? "border-muted" : "border-primary")}>
                            <AvatarImage src={userProfile.photoURL} />
                            <AvatarFallback className="text-2xl">{getInitials(userProfile.displayName)}</AvatarFallback>
                        </Avatar>
                        {isCurrentUser && !member.isMuted && (
                             <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1">
                                <Mic className="w-3 h-3" />
                            </div>
                        )}
                        {member.isMuted && (
                            <div className="absolute bottom-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1">
                                <MicOff className="w-3 h-3" />
                            </div>
                        )}
                        {role === 'owner' && (
                             <div className="absolute top-0 -right-2 bg-yellow-500 text-white rounded-full p-1">
                                <Crown className="w-3 h-3" />
                            </div>
                        )}
                        {role === 'super' && (
                             <div className="absolute top-0 -right-2 bg-blue-500 text-white rounded-full p-1">
                                <Shield className="w-3 h-3" />
                            </div>
                        )}
                        {userProfile.officialBadge?.isOfficial && (
                             <div className="absolute top-0 -left-2">
                                <OfficialBadge color={userProfile.officialBadge.badgeColor} size="icon" className="h-5 w-5" />
                            </div>
                        )}
                    </div>
                     <div className="flex items-center gap-1 w-24 justify-center">
                        <p className={cn(
                          "font-semibold text-sm truncate",
                          userProfile.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                        )}>
                            {userProfile.displayName.split(' ')[0]}
                        </p>
                        {userProfile.verifiedBadge?.showBadge && (
                            <VerifiedBadge color={userProfile.verifiedBadge.badgeColor} className="h-4 w-4 shrink-0" />
                        )}
                    </div>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                 {isCurrentUser && (
                     <DropdownMenuItem onClick={onStandUp}>
                        <UserX className="mr-2 h-4 w-4" />
                        <span>Leave Mic</span>
                    </DropdownMenuItem>
                 )}
                 {(isCurrentUser || canManage) && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => onMuteToggle(member.userId, !member.isMuted)} disabled={!canManage && !isCurrentUser}>
                    {member.isMuted ? <Volume2 className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                    <span>{member.isMuted ? 'Unmute' : 'Mute'} {isCurrentUser ? "" : "User"}</span>
                </DropdownMenuItem>
                {canManage && <DropdownMenuSeparator />}
                {canManage && (
                    <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onKick(member.userId)}>
                        <UserX className="mr-2 h-4 w-4" />
                        <span>Remove from Mic</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const RoomChatMessage = ({ message, senderProfile }: { message: RoomMessage; senderProfile: UserProfile | null }) => {
    if (!senderProfile) return null; // Don't render message if sender profile is not loaded
    return (
        <div className="flex items-start gap-3">
            <div className="relative shrink-0">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={message.senderPhotoURL} />
                    <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
                </Avatar>
                 {senderProfile.officialBadge?.isOfficial && (
                    <div className="absolute -top-1 -left-1">
                        <OfficialBadge color={senderProfile.officialBadge.badgeColor} size="icon" className="h-4 w-4" />
                    </div>
                )}
            </div>
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <p className={cn(
                        "text-sm font-semibold",
                        senderProfile.colorfulName && "font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-pink-500 to-purple-500 background-animate"
                    )}>
                        {message.senderName}
                    </p>
                    {senderProfile.verifiedBadge?.showBadge && <VerifiedBadge color={senderProfile.verifiedBadge.badgeColor} />}
                </div>
                <p className="text-sm text-muted-foreground">{message.content}</p>
            </div>
        </div>
    );
};


export default function RoomPage({ params }: { params: { roomId: string } }) {
  const { roomId } = React.use(params);
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const [chatMessages, setChatMessages] = useState<RoomMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState('');
  
  const [isInviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [inviteSlot, setInviteSlot] = useState<number | undefined>(undefined);
  
  const [isRoomMuted, setIsRoomMuted] = useState(false);
  
  const joinTimestampRef = useRef(Timestamp.now());

  const chatViewportRef = useRef<HTMLDivElement>(null);

  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserMemberInfo = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);
  const isUserOnMic = useMemo(() => currentUserMemberInfo?.micSlot !== null && currentUserMemberInfo?.micSlot !== undefined, [currentUserMemberInfo]);
  const lockedSlots = useMemo(() => room?.lockedSlots || [], [room]);

  // Fetch Room and Member data
  useEffect(() => {
    if (!firestore || !roomId) return;
    setLoading(true);

    const roomDocRef = doc(firestore, 'rooms', roomId);
    const membersColRef = collection(firestore, 'rooms', roomId, 'members');

    const unsubRoom = onSnapshot(roomDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const roomData = { id: docSnap.id, ...docSnap.data() } as Room;
            setRoom(roomData);
        } else {
            toast({ title: "Room not found", variant: "destructive" });
            router.push('/chat/rooms');
        }
    });
    
    const unsubMembers = onSnapshot(membersColRef, (snapshot) => {
        const membersData = snapshot.docs.map(d => d.data() as RoomMember);
        setMembers(membersData);
        
        const ownerMember = membersData.find(m => m.userId === room?.ownerId);
        if(isOwner && authUser && !ownerMember) {
             const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
             setDoc(memberRef, {
                userId: authUser.uid,
                micSlot: 0,
                isMuted: false,
            }, { merge: true });
        }

        const newMemberIds = membersData
            .map(m => m.userId)
            .filter(id => !memberProfiles.has(id));

        if (newMemberIds.length > 0) {
            newMemberIds.forEach(userId => {
                const userDocRef = doc(firestore, 'users', userId);
                getDoc(userDocRef).then(userSnap => {
                    if (userSnap.exists()) {
                        setMemberProfiles(prev => new Map(prev).set(userId, userSnap.data() as UserProfile));
                    }
                });
            });
        }
        setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({path: membersColRef.path, operation: 'list'});
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });
    
    const messagesColRef = collection(firestore, 'rooms', roomId, 'messages');
    const messagesQuery = query(messagesColRef, orderBy('timestamp', 'asc'), where('timestamp', '>=', joinTimestampRef.current));
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
        const messagesData = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as RoomMessage);
        
         const newMessageSenders = messagesData
            .map(m => m.senderId)
            .filter(id => !memberProfiles.has(id));
        
        if (newMessageSenders.length > 0) {
             newMessageSenders.forEach(userId => {
                const userDocRef = doc(firestore, 'users', userId);
                getDoc(userDocRef).then(userSnap => {
                    if (userSnap.exists()) {
                        setMemberProfiles(prev => new Map(prev).set(userId, userSnap.data() as UserProfile));
                    }
                });
            });
        }

        setChatMessages(prevMessages => {
            const newMessages = messagesData.filter(
                (newMessage) => !prevMessages.some((prevMessage) => prevMessage.id === newMessage.id)
            );
            return [...prevMessages, ...newMessages];
        });
    });

    return () => {
        unsubRoom();
        unsubMembers();
        unsubMessages();
    };

  }, [firestore, roomId, router, toast, isOwner, authUser, memberProfiles, room?.ownerId]);
  
  useEffect(() => {
    if(chatViewportRef.current) {
        chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleLeaveRoom = async () => {
      if (!firestore || !authUser || !roomId || !room) return;
      
      const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
      const roomRef = doc(firestore, 'rooms', roomId);
      
      try {
        const batch = writeBatch(firestore);
        
        batch.delete(memberRef);
        batch.update(roomRef, { members: arrayRemove(authUser.uid) });

        await batch.commit();
        router.push('/chat/rooms');

      } catch(error) {
        console.error("Error leaving room:", error);
         router.push('/chat/rooms');
      }
  };

   const handleSit = async (slotNumber: number) => {
      if (!firestore || !authUser || !roomId) return;

      const isSlotOccupied = members.some(m => m.micSlot === slotNumber);
      if (isSlotOccupied) {
          toast({ title: 'Slot Taken', description: 'This mic slot is already occupied.', variant: 'destructive'});
          return;
      }
      
      const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
      
      const newMemberData = {
          userId: authUser.uid,
          micSlot: slotNumber,
          isMuted: currentUserMemberInfo?.isMuted ?? false,
      };
      
      try {
        await setDoc(memberRef, newMemberData, { merge: true });
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'create', requestResourceData: newMemberData});
         errorEmitter.emit('permission-error', permissionError);
      }
  };
  
   const handleStandUp = async () => {
        if (!firestore || !authUser || !roomId) return;
        const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
        try {
             await updateDoc(memberRef, { micSlot: null });
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: memberRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
  
  const handleKickUser = async (userIdToKick: string) => {
      if (!isOwner || !firestore || !roomId) return;
      const memberRef = doc(firestore, 'rooms', roomId, 'members', userIdToKick);
      try {
        await updateDoc(memberRef, { micSlot: null });
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'update'});
         errorEmitter.emit('permission-error', permissionError);
      }
  };
  
  const handleMuteToggle = async (userIdToMute: string, shouldMute: boolean) => {
      if ((!isOwner && userIdToMute !== authUser?.uid) || !firestore || !roomId) return;
      const memberRef = doc(firestore, 'rooms', roomId, 'members', userIdToMute);
       try {
        await updateDoc(memberRef, { isMuted: shouldMute });
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'update', requestResourceData: { isMuted: shouldMute }});
         errorEmitter.emit('permission-error', permissionError);
      }
  };
  
  const handleSendChatMessage = async () => {
    if (!firestore || !authUser || !roomId || !chatInputValue.trim()) return;

    let currentUserProfile = memberProfiles.get(authUser.uid);

    if (!currentUserProfile) {
        const userDoc = await getDoc(doc(firestore, 'users', authUser.uid));
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data() as UserProfile;
            setMemberProfiles(prev => new Map(prev).set(authUser.uid, currentUserProfile!));
        }
    }
    
    const messagesColRef = collection(firestore, 'rooms', roomId, 'messages');
    const newMessage = {
        senderId: authUser.uid,
        senderName: currentUserProfile?.displayName || 'User',
        senderPhotoURL: currentUserProfile?.photoURL || '',
        content: chatInputValue.trim(),
        timestamp: serverTimestamp(),
    };
    
    try {
        await addDoc(messagesColRef, newMessage);
        setChatInputValue('');
    } catch(error) {
         const permissionError = new FirestorePermissionError({path: messagesColRef.path, operation: 'create', requestResourceData: newMessage});
         errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        handleSendChatMessage();
    }
  };

  const handleLockToggle = async (slotNumber: number) => {
    if (!isOwner || !firestore || !room) return;
    const roomRef = doc(firestore, 'rooms', room.id);
    const isCurrentlyLocked = lockedSlots.includes(slotNumber);

    try {
        if (isCurrentlyLocked) {
            await updateDoc(roomRef, { lockedSlots: arrayRemove(slotNumber) });
        } else {
            await updateDoc(roomRef, { lockedSlots: arrayUnion(slotNumber) });
        }
    } catch(error) {
        console.error("Error toggling lock state:", error);
    }
  };

  const handleInvite = (slotNumber?: number) => {
      setInviteSlot(slotNumber);
      setInviteSheetOpen(true);
  }

  if (loading || !room) {
    return <div className="flex h-screen items-center justify-center">Loading Room...</div>;
  }
  
  const ownerMember = members.find(m => m.micSlot === 0);
  const ownerProfile = ownerMember ? memberProfiles.get(ownerMember.userId) : null;
  
  const superAdminMember = members.find(m => m.micSlot === -1);
  const superAdminProfile = superAdminMember ? memberProfiles.get(superAdminMember.userId) : null;

  return (
    <>
      <RoomInviteSheet 
        isOpen={isInviteSheetOpen} 
        onOpenChange={setInviteSheetOpen}
        room={room}
        slotNumber={inviteSlot}
      />
      <div className="flex h-screen flex-col bg-background">
          <header className="flex items-center justify-between gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
              <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => router.back()}>
                      <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                          <AvatarImage src={room.photoURL} />
                          <AvatarFallback>{room.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <h1 className="text-xl font-bold truncate">{room.name}</h1>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleInvite()}>
                      <UserPlus className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                      <Link href={`/chat/rooms/${roomId}/settings`}>
                          <Settings className="h-5 w-5" />
                      </Link>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleLeaveRoom}>
                      <LogOut className="mr-2 h-4 w-4"/> Leave
                  </Button>
              </div>
          </header>
          
          <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 space-y-8">
                  <div className="grid grid-cols-2 gap-4 md:gap-8 max-w-sm mx-auto">
                      {ownerMember && ownerProfile && ownerMember.micSlot === 0 ? (
                          <UserMic member={ownerMember} userProfile={ownerProfile} role="owner" isOwner={true} isCurrentUser={ownerMember.userId === authUser?.uid} onKick={handleKickUser} onMuteToggle={handleMuteToggle} onStandUp={handleStandUp}/>
                      ) : (
                          <MicPlaceholder onSit={handleSit} slotNumber={0} slotType="owner" isOwner={isOwner} onLockToggle={handleLockToggle} isLocked={lockedSlots.includes(0)} onInvite={handleInvite} />
                      )}

                      {superAdminMember && superAdminProfile ? (
                          <UserMic member={superAdminMember} userProfile={superAdminProfile} role="super" isOwner={isOwner} isCurrentUser={superAdminMember.userId === authUser?.uid} onKick={handleKickUser} onMuteToggle={handleMuteToggle} onStandUp={handleStandUp}/>
                      ) : (
                          <MicPlaceholder onSit={handleSit} slotNumber={-1} slotType="super" isOwner={isOwner} onLockToggle={handleLockToggle} isLocked={lockedSlots.includes(-1)} onInvite={handleInvite} />
                      )}
                  </div>
                  
                  <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                          Audience
                          </span>
                      </div>
                  </div>

                  <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                      {Array.from({ length: 8 }).map((_, i) => {
                          const slotNumber = i + 1;
                          const memberInSlot = members.find(m => m.micSlot === slotNumber);
                          const userProfileInSlot = memberInSlot ? memberProfiles.get(memberInSlot.userId) : null;
                          
                          if (memberInSlot && userProfileInSlot) {
                              return <UserMic key={slotNumber} member={memberInSlot} userProfile={userProfileInSlot} role="member" isOwner={isOwner} isCurrentUser={memberInSlot.userId === authUser?.uid} onKick={handleKickUser} onMuteToggle={handleMuteToggle} onStandUp={handleStandUp}/>
                          }
                          
                          return <MicPlaceholder key={slotNumber} onSit={handleSit} slotNumber={slotNumber} isOwner={isOwner} onLockToggle={handleLockToggle} isLocked={lockedSlots.includes(slotNumber)} onInvite={handleInvite} />
                      })}
                  </div>
              </div>

              <ScrollArea className="flex-1 px-4" viewportRef={chatViewportRef}>
                  <div className="space-y-4 py-4">
                      {chatMessages.map(msg => (
                          <RoomChatMessage key={msg.id} message={msg} senderProfile={memberProfiles.get(msg.senderId) ?? null} />
                      ))}
                  </div>
              </ScrollArea>

              <footer className="shrink-0 border-t bg-muted/40 p-2 md:px-4 md:py-2">
                  <div className="flex items-center gap-2">
                       <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleMuteToggle(authUser!.uid, !currentUserMemberInfo?.isMuted)}
                            disabled={!isUserOnMic}
                        >
                           {currentUserMemberInfo?.isMuted ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setIsRoomMuted(!isRoomMuted)}
                        >
                            {isRoomMuted ? <VolumeX className="h-5 w-5"/> : <Volume2 className="h-5 w-5"/>}
                        </Button>
                      <div className="relative flex-1">
                        <Textarea 
                            placeholder="Send a message..."
                            className="min-h-[40px] max-h-[100px] resize-none pr-12 text-sm"
                            rows={1}
                            value={chatInputValue}
                            onChange={(e) => setChatInputValue(e.target.value)}
                            onKeyDown={handleChatKeyPress}
                        />
                        <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleSendChatMessage}>
                            <Send className="h-4 w-4" />
                        </Button>
                      </div>
                  </div>
              </footer>
          </div>
      </div>
    </>
  );
}
