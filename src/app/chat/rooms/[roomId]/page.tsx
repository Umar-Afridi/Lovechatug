'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  User,
  ShieldAlert,
  Users,
  MessageSquare,
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
import { doc, onSnapshot, collection, updateDoc, deleteDoc, setDoc, getDoc, addDoc, serverTimestamp, query, orderBy, arrayUnion, arrayRemove, writeBatch, where, Timestamp, increment, getDocs } from 'firebase/firestore';
import type { Room, RoomMember, UserProfile, RoomMessage, FriendRequest, Chat } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Textarea } from '@/components/ui/textarea';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { RoomInviteSheet } from '@/components/chat/room-invite-sheet';
import { RoomUserProfileSheet } from '@/components/chat/room-user-profile-sheet';
import { RoomMembersSheet } from '@/components/chat/room-members-sheet';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useRoomContext } from '../../layout';


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
             <p className="font-semibold text-sm text-muted-foreground capitalize">
                 {slotType ? slotType : slotNumber}
             </p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
         <div className="flex flex-col">
            <Button variant="ghost" onClick={() => onSit(slotNumber)} className="w-full justify-start px-4 py-2" disabled={(isLocked && !isOwner) || (disabled && !isOwner)}>
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

const UserMic = ({ member, userProfile, role, isOwner, isCurrentUser, onKick, onMuteToggle, onStandUp, onViewProfile, onKickFromRoom }: { 
    member: RoomMember | null;
    userProfile: UserProfile | null;
    role?: 'owner' | 'super' | 'member'; 
    isOwner: boolean;
    isCurrentUser: boolean;
    onKick: (userId: string) => void;
    onMuteToggle: (userId: string, isMuted: boolean) => void;
    onStandUp: () => void;
    onViewProfile: (user: UserProfile) => void;
    onKickFromRoom: (userId: string) => void;
}) => {
    
    if (!userProfile || !member) return null;
    
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

    const canManage = isOwner && !isCurrentUser;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <div className="flex flex-col items-center gap-2 text-center cursor-pointer">
                    <div className="relative">
                        <Avatar className={cn(
                          "w-20 h-20 border-2", 
                          member.isMuted ? "border-muted" : "border-primary",
                          !member.isMuted && "talking-indicator"
                        )}>
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
                 <DropdownMenuItem onClick={() => onViewProfile(userProfile)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                 </DropdownMenuItem>
                 
                 {isCurrentUser && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onMuteToggle(member.userId, !member.isMuted)}>
                            {member.isMuted ? <Volume2 className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                            <span>{member.isMuted ? 'Unmute' : 'Mute'}</span>
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={onStandUp}>
                            <UserX className="mr-2 h-4 w-4" />
                            <span>Leave Mic</span>
                        </DropdownMenuItem>
                    </>
                 )}
                 
                {canManage && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onMuteToggle(member.userId, !member.isMuted)}>
                            {member.isMuted ? <Volume2 className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                            <span>{member.isMuted ? 'Unmute' : 'Mute'} User</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-destructive/10" onClick={() => onKick(member.userId)}>
                            <UserX className="mr-2 h-4 w-4" />
                            <span>Remove from Mic</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onKickFromRoom(member.userId)}>
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            <span>Kick from Room</span>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const RoomChatMessage = ({ message, senderProfile }: { message: RoomMessage; senderProfile: UserProfile | null }) => {
    
    if (message.type === 'notification') {
        return (
            <div className="text-center text-xs text-muted-foreground py-1">
                {message.content}
            </div>
        )
    }

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
  const { setCurrentRoom, leaveCurrentRoom } = useRoomContext();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const [chatMessages, setChatMessages] = useState<RoomMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState('');
  
  const [isInviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [inviteSlot, setInviteSlot] = useState<number | undefined>(undefined);
  
  const [isRoomMuted, setIsRoomMuted] = useState(false);
  
  const [isProfileSheetOpen, setProfileSheetOpen] = useState(false);
  const [isMembersSheetOpen, setMembersSheetOpen] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  
  const [isKicked, setIsKicked] = useState(false);

  const joinTimestampRef = useRef(Timestamp.now());
  const prevMemberIdsRef = useRef<string[]>([]);
  
  const chatViewportRef = useRef<HTMLDivElement>(null);

  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserMemberInfo = useMemo(() => members.find(m => m.userId === authUser?.uid), [members, authUser]);
  const isUserOnMic = useMemo(() => currentUserMemberInfo?.micSlot !== null && currentUserMemberInfo?.micSlot !== undefined, [currentUserMemberInfo]);
  const lockedSlots = useMemo(() => room?.lockedSlots || [], [room]);

  // Fetch Current User Profile, Friend Requests and Unread Counts
  useEffect(() => {
    if (!firestore || !authUser) return;

    // Profile listener
    const unsubProfile = onSnapshot(doc(firestore, 'users', authUser.uid), (doc) => {
        if(doc.exists()) setCurrentUserProfile(doc.data() as UserProfile);
    });

    // Friend requests listener
    const requestsRef = collection(firestore, 'friendRequests');
    const sentQuery = query(requestsRef, where('senderId', '==', authUser.uid));
    const receivedQuery = query(requestsRef, where('receiverId', '==', authUser.uid));

    const unsubSent = onSnapshot(sentQuery, snap => {
        setFriendRequests(prev => [...prev.filter(r => r.senderId !== authUser.uid), ...snap.docs.map(d => d.data() as FriendRequest)]);
    });
    const unsubReceived = onSnapshot(receivedQuery, snap => {
        setFriendRequests(prev => [...prev.filter(r => r.receiverId !== authUser.uid), ...snap.docs.map(d => d.data() as FriendRequest)]);
    });

    // Unread messages listener
    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(chatsRef, where('members', 'array-contains', authUser.uid));
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
        let total = 0;
        snapshot.forEach(doc => {
            const chat = doc.data() as Chat;
            total += chat.unreadCount?.[authUser.uid] ?? 0;
        });
        setTotalUnreadCount(total);
    });

    return () => {
        unsubProfile();
        unsubSent();
        unsubReceived();
        unsubChats();
    }
  }, [firestore, authUser]);
  
  // Join/Leave Logic & Setting current room in context
    useEffect(() => {
        if (!firestore || !authUser || !roomId || !currentUserProfile) return;

        const memberRef = doc(firestore, 'rooms', roomId, 'members', authUser.uid);
        const roomRef = doc(firestore, 'rooms', roomId);

        const joinRoom = async () => {
             const roomDoc = await getDoc(roomRef);
             if (!roomDoc.exists()) {
                toast({ title: "Room not found", variant: "destructive" });
                router.push('/chat/rooms');
                return;
             } 
             
             const roomData = roomDoc.data() as Room;
             setCurrentRoom({ id: roomDoc.id, ...roomData });


             if (roomData.kickedUsers?.[authUser.uid]) {
                 setIsKicked(true);
                 return;
             }
             
             const memberDoc = await getDoc(memberRef);
             const batch = writeBatch(firestore);

            if (!memberDoc.exists()) {
                batch.set(memberRef, {
                    userId: authUser.uid,
                    micSlot: roomData.ownerId === authUser.uid ? 0 : null,
                    isMuted: false,
                });
                batch.update(roomRef, { memberCount: increment(1) });
                await batch.commit();
            } else if (roomData.ownerId === authUser.uid && memberDoc.data()?.micSlot !== 0) {
                 await updateDoc(memberRef, { micSlot: 0 });
            }
        };

        joinRoom();

        return () => {
          // Leave room logic is handled by the layout context now
        };
    }, [firestore, authUser, roomId, currentUserProfile, router, toast, setCurrentRoom]);
  
  // Fetch Room, Members, and Messages
  useEffect(() => {
    if (!firestore || !roomId || !authUser) return;
    setLoading(true);

    const roomDocRef = doc(firestore, 'rooms', roomId);
    const membersColRef = collection(firestore, 'rooms', roomId, 'members');
    
    // --- Room Listener ---
    const unsubRoom = onSnapshot(roomDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const roomData = { id: docSnap.id, ...docSnap.data() } as Room;
            setRoom(roomData);
            setCurrentRoom(roomData); // Keep context updated

            if (roomData.kickedUsers?.[authUser.uid]) {
                setIsKicked(true);
            }
        } else {
            toast({ title: "Room not found", variant: "destructive" });
            router.push('/chat/rooms');
        }
    });
    
    // --- Members Listener ---
    const unsubMembers = onSnapshot(membersColRef, async (snapshot) => {
        const membersData = snapshot.docs.map(d => d.data() as RoomMember);
        setMembers(membersData);
        setLoading(false); // We can show the room UI once members are loaded

        const memberIds = membersData.map(m => m.userId);
        const newProfiles = new Map(memberProfiles);
        let profilesChanged = false;

        const newMemberIds = memberIds.filter(id => !newProfiles.has(id));

        if (newMemberIds.length > 0) {
            const userDocs = await Promise.all(newMemberIds.map(userId => getDoc(doc(firestore, 'users', userId))));
            userDocs.forEach(userSnap => {
                if (userSnap.exists()) {
                    newProfiles.set(userSnap.id, userSnap.data() as UserProfile);
                    profilesChanged = true;
                }
            });
        }
        
        if (profilesChanged) {
            setMemberProfiles(newProfiles);
        }

        // --- Join/Leave Notifications ---
        const oldMemberIds = prevMemberIdsRef.current;
        if (oldMemberIds.length > 0) { // Don't show notifications on initial load
            const justJoinedIds = memberIds.filter(id => !oldMemberIds.includes(id));
            const justLeftIds = oldMemberIds.filter(id => !memberIds.includes(id));
            const notifications: RoomMessage[] = [];

            justJoinedIds.forEach(userId => {
                const profile = newProfiles.get(userId);
                if (profile) {
                    notifications.push({
                        id: `notification-join-${Date.now()}-${profile.uid}`,
                        senderId: 'system', senderName: 'System', senderPhotoURL: '',
                        content: `${profile.displayName} has joined the room`,
                        timestamp: serverTimestamp(), type: 'notification',
                    });
                }
            });

            justLeftIds.forEach(userId => {
                const profile = memberProfiles.get(userId); // Use old profiles map
                if (profile) {
                    notifications.push({
                        id: `notification-leave-${Date.now()}-${profile.uid}`,
                        senderId: 'system', senderName: 'System', senderPhotoURL: '',
                        content: `${profile.displayName} has left the room`,
                        timestamp: serverTimestamp(), type: 'notification',
                    });
                }
            });
            
            if (notifications.length > 0) {
                setChatMessages(prev => [...prev, ...notifications]);
            }
        }

        prevMemberIdsRef.current = memberIds;

    }, (error) => {
        const permissionError = new FirestorePermissionError({path: membersColRef.path, operation: 'list'});
        errorEmitter.emit('permission-error', error);
        setLoading(false);
    });
    
    // --- Messages Listener ---
    const messagesColRef = collection(firestore, 'rooms', roomId, 'messages');
    const messagesQuery = query(messagesColRef, orderBy('timestamp', 'asc'), where('timestamp', '>=', joinTimestampRef.current));
    const unsubMessages = onSnapshot(messagesQuery, async (snapshot) => {
        const messagesData = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as RoomMessage);
        
         const newMessageSenders = messagesData
            .map(m => m.senderId)
            .filter(id => id !== 'system' && !memberProfiles.has(id));
        
        if (newMessageSenders.length > 0) {
             const userDocs = await Promise.all(newMessageSenders.map(userId => getDoc(doc(firestore, 'users', userId))));
             setMemberProfiles(prev => {
                const newProfiles = new Map(prev);
                userDocs.forEach(userSnap => {
                    if (userSnap.exists()) {
                         newProfiles.set(userSnap.id, userSnap.data() as UserProfile);
                    }
                });
                return newProfiles;
             });
        }

        setChatMessages(prevMessages => {
            const existingMessageIds = new Set(prevMessages.map(m => m.id));
            const newMessages = messagesData.filter(m => !existingMessageIds.has(m.id));
            if (newMessages.length === 0) return prevMessages;
            const combined = [...prevMessages, ...newMessages];
            // Sort to ensure order is correct, especially with notifications
            return combined.sort((a,b) => {
                const aTime = a.timestamp?.seconds ?? Date.now() / 1000;
                const bTime = b.timestamp?.seconds ?? Date.now() / 1000;
                return aTime - bTime;
            });
        });
    });

    return () => {
        unsubRoom();
        unsubMembers();
        unsubMessages();
    };

  }, [firestore, roomId, authUser, toast, router, setCurrentRoom]);
  
  useEffect(() => {
    if(chatViewportRef.current) {
        chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
    const handleNavigateBack = () => {
        leaveCurrentRoom();
        router.push('/chat/rooms');
    };
    
    useEffect(() => {
        if (isKicked) {
            leaveCurrentRoom();
            router.push('/chat/rooms');
        }
    }, [isKicked, router, leaveCurrentRoom]);

   const handleSit = async (slotNumber: number) => {
      if (!firestore || !authUser || !roomId) return;
      
      if (!isOwner && slotNumber === 0) {
        toast({ title: "Permission Denied", description: "Only the room owner can take this seat.", variant: "destructive" });
        return;
      }

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
  
  const handleKickUserFromMic = async (userIdToKick: string) => {
      if (!isOwner || !firestore || !roomId) return;
      const memberRef = doc(firestore, 'rooms', roomId, 'members', userIdToKick);
      try {
        await updateDoc(memberRef, { micSlot: null });
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'update'});
         errorEmitter.emit('permission-error', permissionError);
      }
  };
  
  const handleKickUserFromRoom = async (userIdToKick: string) => {
    if (!isOwner || !firestore || !room || !authUser || userIdToKick === authUser.uid) return;

    const roomRef = doc(firestore, 'rooms', room.id);
    const memberRef = doc(firestore, 'rooms', room.id, 'members', userIdToKick);

    try {
        const batch = writeBatch(firestore);

        batch.delete(memberRef);
        
        const kickedField = `kickedUsers.${userIdToKick}`;
        batch.update(roomRef, {
            memberCount: increment(-1),
            [kickedField]: serverTimestamp()
        });

        await batch.commit();
        toast({ title: 'User Kicked', description: 'The user has been removed from the room.' });

    } catch (error) {
        console.error('Error kicking user from room:', error);
        const permissionError = new FirestorePermissionError({ path: roomRef.path, operation: 'update' });
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

  const handleViewProfile = (user: UserProfile) => {
      setSelectedUserProfile(user);
      setProfileSheetOpen(true);
  };
  
  const handleViewMembers = () => {
    setMembersSheetOpen(true);
  }

  const handleSendFriendRequest = async (receiverId: string) => {
      if (!firestore || !authUser) return;
      const requestsRef = collection(firestore, 'friendRequests');
      const newRequest = {
          senderId: authUser.uid,
          receiverId: receiverId,
          status: 'pending' as const,
          createdAt: serverTimestamp(),
      };
      
      try {
          const q = query(requestsRef, where('senderId', '==', authUser.uid), where('receiverId', '==', receiverId));
          const q2 = query(requestsRef, where('senderId', '==', receiverId), where('receiverId', '==', authUser.uid));
          
          const [sentSnapshot, receivedSnapshot] = await Promise.all([getDocs(q), getDocs(q2)]);

          if (!sentSnapshot.empty || !receivedSnapshot.empty) {
            toast({ title: 'Request Already Exists', description: 'A friend request between you and this user already exists.', variant: 'default' });
            return;
          }

          await addDoc(requestsRef, newRequest);
          toast({ title: 'Request Sent', description: 'Your friend request has been sent.'});
          setProfileSheetOpen(false);
      } catch (error) {
          console.error("Error sending friend request:", error);
          const permissionError = new FirestorePermissionError({ path: requestsRef.path, operation: 'create', requestResourceData: newRequest });
          errorEmitter.emit('permission-error', permissionError);
          toast({ title: 'Error', description: 'Could not send friend request.', variant: 'destructive'});
      }
  };


  if (loading || !room) {
    return <div className="flex h-screen items-center justify-center">Loading Room...</div>;
  }
  
  const ownerMember = members.find(m => m.micSlot === 0);
  const ownerProfile = ownerMember ? memberProfiles.get(ownerMember.userId) : null;
  
  const superAdminMember = members.find(m => m.micSlot === -1);
  const superAdminProfile = superAdminMember ? memberProfiles.get(superAdminMember.userId) : null;

  return (
    <>
      <AlertDialog open={isKicked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have been kicked from the room</AlertDialogTitle>
            <AlertDialogDescription>
              The room owner has removed you from this room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => {
              leaveCurrentRoom();
              router.push('/chat/rooms');
          }}>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      <RoomInviteSheet 
        isOpen={isInviteSheetOpen} 
        onOpenChange={setInviteSheetOpen}
        room={room}
        slotNumber={inviteSlot}
      />
       <RoomUserProfileSheet
        isOpen={isProfileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        userToView={selectedUserProfile}
        currentUser={currentUserProfile}
        friendRequests={friendRequests}
        onSendRequest={handleSendFriendRequest}
      />
      <RoomMembersSheet
        isOpen={isMembersSheetOpen}
        onOpenChange={setMembersSheetOpen}
        members={members}
        memberProfiles={memberProfiles}
        onViewProfile={handleViewProfile}
      />
      <div className="flex h-screen flex-col bg-background">
          <header className="flex items-center justify-between gap-4 border-b p-4 sticky top-0 bg-background/95 z-10">
              <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
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
                  {isOwner && (
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/chat/rooms/${roomId}/settings`}>
                            <Settings className="h-5 w-5" />
                        </Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="relative" onClick={handleViewMembers}>
                      <Users className="h-5 w-5" />
                      {members.length > 0 && (
                          <Badge variant="secondary" className="absolute -top-1 -right-2 h-5 min-w-[1.25rem] justify-center p-1 text-xs">
                            {members.length}
                          </Badge>
                      )}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleNavigateBack}>
                      <LogOut className="mr-2 h-4 w-4"/> Leave
                  </Button>
              </div>
          </header>
          
          <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 space-y-8">
                  <div className="grid grid-cols-2 gap-4 md:gap-8 max-w-sm mx-auto">
                      {ownerMember && ownerProfile ? (
                          <UserMic member={ownerMember} userProfile={ownerProfile} role="owner" isOwner={true} isCurrentUser={ownerMember.userId === authUser?.uid} onKick={handleKickUserFromMic} onMuteToggle={handleMuteToggle} onStandUp={handleStandUp} onViewProfile={handleViewProfile} onKickFromRoom={handleKickUserFromRoom} />
                      ) : (
                          <MicPlaceholder onSit={handleSit} slotNumber={0} slotType="owner" disabled={!isOwner} isOwner={isOwner} onLockToggle={handleLockToggle} isLocked={lockedSlots.includes(0)} onInvite={handleInvite} />
                      )}

                      {superAdminMember && superAdminProfile ? (
                          <UserMic member={superAdminMember} userProfile={superAdminProfile} role="super" isOwner={isOwner} isCurrentUser={superAdminMember.userId === authUser?.uid} onKick={handleKickUserFromMic} onMuteToggle={handleMuteToggle} onStandUp={handleStandUp} onViewProfile={handleViewProfile} onKickFromRoom={handleKickUserFromRoom}/>
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
                              return <UserMic key={slotNumber} member={memberInSlot} userProfile={userProfileInSlot} role="member" isOwner={isOwner} isCurrentUser={memberInSlot.userId === authUser?.uid} onKick={handleKickUserFromMic} onMuteToggle={handleMuteToggle} onStandUp={handleStandUp} onViewProfile={handleViewProfile} onKickFromRoom={handleKickUserFromRoom} />
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
                    <div className="relative flex-1">
                        <Textarea 
                            placeholder="Send a message..."
                            className="min-h-[40px] max-h-[100px] resize-none pr-10 text-sm"
                            rows={1}
                            value={chatInputValue}
                            onChange={(e) => setChatInputValue(e.target.value)}
                            onKeyDown={handleChatKeyPress}
                        />
                         <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleSendChatMessage}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                     <Button variant="ghost" size="icon" asChild className="relative">
                        <Link href="/chat">
                            <MessageSquare className="h-5 w-5"/>
                            {totalUnreadCount > 0 && (
                                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>
                            )}
                        </Link>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => authUser && currentUserMemberInfo && handleMuteToggle(authUser.uid, !currentUserMemberInfo.isMuted)}
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
                </div>
              </footer>
          </div>
      </div>
    </>
  );
}
