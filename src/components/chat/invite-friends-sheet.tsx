'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  addDoc,
  increment,
} from 'firebase/firestore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, Room } from '@/lib/types';
import { Send, Check } from 'lucide-react';

interface InviteFriendsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
}

export function InviteFriendsSheet({ isOpen, onOpenChange, room }: InviteFriendsSheetProps) {
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sentInvites, setSentInvites] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !firestore || !authUser) {
      setFriends([]);
      setSentInvites([]);
      setSearchQuery('');
      return;
    }

    const fetchFriends = async () => {
      setLoading(true);
      try {
        const userDocRef = doc(firestore, 'users', authUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as UserProfile;
          const friendIds = userData.friends || [];

          if (friendIds.length > 0) {
            const friendsQuery = query(collection(firestore, 'users'), where('uid', 'in', friendIds));
            const friendsSnapshot = await getDocs(friendsQuery);
            const friendsList = friendsSnapshot.docs.map(d => d.data() as UserProfile);
            setFriends(friendsList);
          } else {
            setFriends([]);
          }
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
        toast({ title: 'Error', description: 'Could not load your friends list.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [isOpen, firestore, authUser, toast]);

  const handleSendInvite = async (friend: UserProfile) => {
    if (!firestore || !authUser || !room) return;

    try {
      const chatId = [authUser.uid, friend.uid].sort().join('_');
      const chatRef = doc(firestore, 'chats', chatId);
      const messagesRef = collection(chatRef, 'messages');
      
      const batch = writeBatch(firestore);

      const inviteMessage = {
        senderId: authUser.uid,
        content: `You've been invited to the room: ${room.name}`,
        timestamp: serverTimestamp(),
        type: 'room_invite' as const,
        status: 'sent' as const,
        roomInvite: {
          roomId: room.id,
          roomName: room.name,
          roomPhotoURL: room.photoURL || '',
        },
      };
      
      const newMessageRef = doc(messagesRef);
      batch.set(newMessageRef, inviteMessage);

      batch.update(chatRef, {
        lastMessage: {
            content: `✉️ Room Invitation`,
            timestamp: serverTimestamp(),
            senderId: authUser.uid,
        },
        [`unreadCount.${friend.uid}`]: increment(1),
      });

      await batch.commit();

      setSentInvites(prev => [...prev, friend.uid]);
      toast({ title: 'Invite Sent!', description: `Invitation sent to ${friend.displayName}.` });
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({ title: 'Error', description: 'Could not send the invitation.', variant: 'destructive' });
    }
  };
  
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  const filteredFriends = friends.filter(friend =>
    friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>Invite Friends</SheetTitle>
          <SheetDescription>
            Send an invitation to your friends to join the room.
          </SheetDescription>
        </SheetHeader>
        
        <div className="px-6 py-2 border-b">
             <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
             <div className="p-6 text-center text-muted-foreground">Loading friends...</div>
          ) : filteredFriends.length > 0 ? (
            <div className="p-4 space-y-2">
                {filteredFriends.map(friend => {
                    const isInviteSent = sentInvites.includes(friend.uid);
                    return (
                         <div key={friend.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={friend.photoURL} />
                                    <AvatarFallback>{getInitials(friend.displayName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{friend.displayName}</p>
                                    <p className="text-sm text-muted-foreground">@{friend.username}</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => handleSendInvite(friend)}
                                disabled={isInviteSent}
                            >
                                {isInviteSent ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                                {isInviteSent ? 'Sent' : 'Send'}
                            </Button>
                        </div>
                    )
                })}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
                <p>{friends.length === 0 ? "You don't have any friends to invite yet." : "No friends found matching your search."}</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
