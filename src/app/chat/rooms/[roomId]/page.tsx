'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import type { Room, RoomMember, UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Textarea } from '@/components/ui/textarea';


const MicPlaceholder = ({ onSit, slotNumber }: { onSit: (slot: number) => void; slotNumber: number; }) => (
    <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center">
            <Mic className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <Button size="sm" variant="outline" onClick={() => onSit(slotNumber)}>Sit</Button>
    </div>
);

const UserMic = ({ member, userProfile, role, isOwner, onKick, onMuteToggle }: { 
    member: RoomMember | null;
    userProfile: UserProfile | null;
    role?: 'owner' | 'super' | 'member'; 
    isOwner: boolean;
    onKick: (userId: string) => void;
    onMuteToggle: (userId: string, isMuted: boolean) => void;
}) => {
    
    if (!userProfile || !member) return null;
    
    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!isOwner || member.userId === userProfile.uid}>
                 <div className="flex flex-col items-center gap-2 text-center cursor-pointer">
                    <div className="relative">
                        <Avatar className={cn("w-20 h-20 border-2", member.isMuted ? "border-muted" : "border-primary")}>
                            <AvatarImage src={userProfile.photoURL} />
                            <AvatarFallback className="text-2xl">{getInitials(userProfile.displayName)}</AvatarFallback>
                        </Avatar>
                        {member.isMuted && (
                            <div className="absolute bottom-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1">
                                <MicOff className="w-3 h-3" />
                            </div>
                        )}
                        {role === 'owner' && (
                             <div className="absolute top-0 right-0 bg-yellow-500 text-white rounded-full p-1">
                                <Crown className="w-3 h-3" />
                            </div>
                        )}
                        {role === 'super' && (
                             <div className="absolute top-0 right-0 bg-blue-500 text-white rounded-full p-1">
                                <Shield className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                    <p className="font-semibold text-sm truncate w-24">{userProfile.displayName.split(' ')[0]}</p>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onMuteToggle(member.userId, !member.isMuted)}>
                    {member.isMuted ? <Volume2 className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                    <span>{member.isMuted ? 'Unmute' : 'Mute'} User</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onKick(member.userId)}>
                    <UserX className="mr-2 h-4 w-4" />
                    <span>Remove from Mic</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


export default function RoomPage({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);

  const isOwner = useMemo(() => room?.ownerId === authUser?.uid, [room, authUser]);
  const currentUserMicSlot = useMemo(() => members.find(m => m.userId === authUser?.uid)?.micSlot, [members, authUser]);

  // Fetch Room and Member data
  useEffect(() => {
    if (!firestore || !params.roomId) return;
    setLoading(true);

    const roomDocRef = doc(firestore, 'rooms', params.roomId);
    const membersColRef = collection(firestore, 'rooms', params.roomId, 'members');

    const unsubRoom = onSnapshot(roomDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setRoom({ id: docSnap.id, ...docSnap.data() } as Room);
        } else {
            toast({ title: "Room not found", variant: "destructive" });
            router.push('/chat/rooms');
        }
    });

    const unsubMembers = onSnapshot(membersColRef, (snapshot) => {
        const membersData = snapshot.docs.map(d => d.data() as RoomMember);
        setMembers(membersData);

        // Fetch profiles for new members
        membersData.forEach(member => {
            if (!memberProfiles.has(member.userId)) {
                const userDocRef = doc(firestore, 'users', member.userId);
                getDoc(userDocRef).then(userSnap => {
                    if (userSnap.exists()) {
                        setMemberProfiles(prev => new Map(prev).set(member.userId, userSnap.data() as UserProfile));
                    }
                });
            }
        });
        setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({path: membersColRef.path, operation: 'list'});
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => {
        unsubRoom();
        unsubMembers();
    };

  }, [firestore, params.roomId, router, toast]);

  const handleLeaveRoom = async () => {
      if (!firestore || !authUser || !params.roomId) return;
      const memberRef = doc(firestore, 'rooms', params.roomId, 'members', authUser.uid);
      try {
        await deleteDoc(memberRef);
        router.push('/chat/rooms');
      } catch(error) {
        const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'delete'});
        errorEmitter.emit('permission-error', permissionError);
      }
  };

  const handleSit = async (slotNumber: number) => {
      if (!firestore || !authUser || !params.roomId || currentUserMicSlot !== undefined) return;
      
      const memberRef = doc(firestore, 'rooms', params.roomId, 'members', authUser.uid);
      const newMemberData = {
          userId: authUser.uid,
          micSlot: slotNumber,
          isMuted: false,
      };
      
      try {
        await setDoc(memberRef, newMemberData);
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'create', requestResourceData: newMemberData});
         errorEmitter.emit('permission-error', permissionError);
      }
  };
  
  const handleKickUser = async (userIdToKick: string) => {
      if (!isOwner || !firestore || !params.roomId) return;
      const memberRef = doc(firestore, 'rooms', params.roomId, 'members', userIdToKick);
      try {
        await deleteDoc(memberRef);
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'delete'});
         errorEmitter.emit('permission-error', permissionError);
      }
  };
  
  const handleMuteToggle = async (userIdToMute: string, shouldMute: boolean) => {
      if (!isOwner || !firestore || !params.roomId) return;
      const memberRef = doc(firestore, 'rooms', params.roomId, 'members', userIdToMute);
       try {
        await updateDoc(memberRef, { isMuted: shouldMute });
      } catch(error) {
         const permissionError = new FirestorePermissionError({path: memberRef.path, operation: 'update', requestResourceData: { isMuted: shouldMute }});
         errorEmitter.emit('permission-error', permissionError);
      }
  };

  if (loading || !room) {
    return <div className="flex h-screen items-center justify-center">Loading Room...</div>;
  }
  
  const ownerMember = members.find(m => m.micSlot === 0);
  const ownerProfile = ownerMember ? memberProfiles.get(ownerMember.userId) : null;
  // Note: Super admin logic can be added here if needed
  const superAdminProfile = null; 

  return (
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
             <Button variant="destructive" size="sm" onClick={handleLeaveRoom}>
                <LogOut className="mr-2 h-4 w-4"/> Leave
            </Button>
        </header>
        
        <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="p-4 md:p-6 space-y-8">
                    {/* Owner & Super Admin Mics */}
                    <div className="grid grid-cols-2 gap-4 md:gap-8">
                        {ownerMember && ownerProfile ? (
                            <UserMic member={ownerMember} userProfile={ownerProfile} role="owner" isOwner={isOwner} onKick={handleKickUser} onMuteToggle={handleMuteToggle}/>
                        ) : <div/>}
                        {superAdminProfile ? (
                            <UserMic member={null} userProfile={superAdminProfile} role="super" isOwner={isOwner} onKick={handleKickUser} onMuteToggle={handleMuteToggle}/>
                        ) : <div/>}
                    </div>
                    
                    {/* Separator */}
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

                    {/* User Mics */}
                    <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                        {Array.from({ length: 8 }).map((_, i) => {
                            const slotNumber = i + 1;
                            const memberInSlot = members.find(m => m.micSlot === slotNumber);
                            const userProfileInSlot = memberInSlot ? memberProfiles.get(memberInSlot.userId) : null;
                            
                            if (memberInSlot && userProfileInSlot) {
                                return <UserMic key={slotNumber} member={memberInSlot} userProfile={userProfileInSlot} role="member" isOwner={isOwner} onKick={handleKickUser} onMuteToggle={handleMuteToggle} />
                            }
                            
                            return <MicPlaceholder key={slotNumber} onSit={handleSit} slotNumber={slotNumber}/>
                        })}
                    </div>
                </div>
            </ScrollArea>
             {/* In-Room Chat Input */}
            <footer className="shrink-0 border-t bg-muted/40 p-2 md:p-4">
                <div className="relative flex items-center gap-2">
                    <Textarea 
                        placeholder="Send a message to the room..."
                        className="min-h-[40px] max-h-[100px] resize-none pr-12"
                        rows={1}
                    />
                    <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </footer>
        </div>
    </div>
  );
}
