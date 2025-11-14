
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment, writeBatch } from 'firebase/firestore';
import type { UserProfile, Room } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Search, UserPlus } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface RoomInviteSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  room: Room;
  slotNumber?: number;
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('');
};

export function RoomInviteSheet({
  isOpen,
  onOpenChange,
  room,
  slotNumber,
}: RoomInviteSheetProps) {

  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);

  useEffect(() => {
    if (!authUser || !firestore || !isOpen) {
        setLoading(false);
        return;
    };
    
    setLoading(true);
    const userDocRef = doc(firestore, 'users', authUser.uid);
    getDoc(userDocRef).then(async (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            const friendIds = userData.friends || [];
            
            if (friendIds.length > 0) {
                 try {
                    const usersRef = collection(firestore, 'users');
                    const q = query(usersRef, where('uid', 'in', friendIds));
                    const querySnapshot = await getDocs(q);
                    const friendProfiles = querySnapshot.docs.map(d => d.data() as UserProfile);
                    setFriends(friendProfiles);
                } catch (error) {
                    console.error("Error fetching friend profiles:", error);
                    const permissionError = new FirestorePermissionError({path: 'users', operation: 'list'});
                    errorEmitter.emit('permission-error', permissionError);
                }
            } else {
                setFriends([]);
            }
        }
        setLoading(false);
    }).catch(error => {
        console.error("Error fetching current user profile:", error);
        setLoading(false);
    });

  }, [authUser, firestore, isOpen]);

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    return friends.filter(friend => 
        friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, friends]);

  const handleInvite = async (friend: UserProfile) => {
    if (!authUser || !firestore || !room) return;

    const chatId = [authUser.uid, friend.uid].sort().join('_');
    const chatRef = doc(firestore, 'chats', chatId);
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');

    const inviteMessage = {
        senderId: authUser.uid,
        content: `You've been invited to the room: ${room.name}`,
        timestamp: serverTimestamp(),
        type: 'room_invite' as const,
        status: 'sent' as const, // Assume sent, will update to delivered if user is online
        roomInvite: {
            roomId: room.id,
            roomName: room.name,
            roomPhotoURL: room.photoURL || '',
        },
    };
    
    const lastMessage = {
      content: 'Room Invitation',
      timestamp: serverTimestamp(),
      senderId: authUser.uid,
    };
    
    try {
        const batch = writeBatch(firestore);

        // Add the message
        const messageRef = doc(messagesRef);
        batch.set(messageRef, inviteMessage);
        
        // Update the last message and unread count for the chat
        const unreadCountKey = `unreadCount.${friend.uid}`;
        batch.update(chatRef, {
            lastMessage,
            [unreadCountKey]: increment(1)
        });

        await batch.commit();

        setInvitedFriends(prev => [...prev, friend.uid]);
        toast({
            title: 'Invitation Sent!',
            description: `An invite to join "${room.name}" has been sent to ${friend.displayName}.`
        });

    } catch (error) {
        console.error("Error sending room invite:", error);
        const permissionError = new FirestorePermissionError({path: messagesRef.path, operation: 'create', requestResourceData: inviteMessage});
        errorEmitter.emit('permission-error', permissionError);
        toast({
            title: 'Error',
            description: 'Could not send the invitation.',
            variant: 'destructive',
        });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5"/>
              Invite Friends to Room
          </SheetTitle>
          <SheetDescription>
            Select friends to invite to "{room.name}".
          </SheetDescription>
        </SheetHeader>

        <div className="relative my-4">
            <Input 
                placeholder="Search friends..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        </div>
        
        <ScrollArea className="flex-1">
          {loading ? (
              <p className="text-center text-muted-foreground">Loading friends...</p>
          ) : filteredFriends.length > 0 ? (
              <div className="space-y-2">
                  {filteredFriends.map(friend => (
                      <div key={friend.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={friend.photoURL}/>
                                <AvatarFallback>{getInitials(friend.displayName)}</AvatarFallback>
                            </Avatar>
                             <div>
                                <p className="font-medium">{friend.displayName}</p>
                                <p className="text-xs text-muted-foreground">@{friend.username}</p>
                            </div>
                        </div>
                        <Button 
                            size="sm"
                            onClick={() => handleInvite(friend)}
                            disabled={invitedFriends.includes(friend.uid)}
                        >
                           {invitedFriends.includes(friend.uid) ? 'Invited' : 'Invite'}
                        </Button>
                      </div>
                  ))}
              </div>
          ) : (
             <p className="text-center text-muted-foreground pt-8">
                 {searchQuery ? 'No friends found.' : "You don't have any friends to invite."}
            </p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
