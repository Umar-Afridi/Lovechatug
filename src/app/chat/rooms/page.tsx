'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Room } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const RoomCard = ({ room }: { room: Room }) => {
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'R';
  return (
    <Link href={`/chat/rooms/${room.id}`} className="block">
      <div className="border rounded-lg p-4 flex flex-col items-center gap-3 text-center hover:bg-muted/50 transition-colors">
        <Avatar className="h-20 w-20 border">
          <AvatarImage src={room.photoURL} />
          <AvatarFallback className="text-2xl bg-muted">{getInitials(room.name)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h3 className="font-semibold truncate">{room.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {room.members?.length || 0} listening
          </p>
        </div>
      </div>
    </Link>
  )
};


export default function RoomsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [userHasRoom, setUserHasRoom] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;

        const roomsQuery = query(collection(firestore, 'rooms'));
        const unsubscribe = onSnapshot(roomsQuery, 
            (snapshot) => {
                const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
                setRooms(roomsData);

                if(user) {
                    const currentUserRoom = roomsData.find(room => room.ownerId === user.uid);
                    setUserHasRoom(!!currentUserRoom);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching rooms: ", error);
                const permissionError = new FirestorePermissionError({path: 'rooms', operation: 'list'});
                errorEmitter.emit('permission-error', permissionError);
                setLoading(false);
            }
        );
        
        return () => unsubscribe();
    }, [firestore, user]);

  if (loading) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-muted/20">
            <p className="text-muted-foreground">Loading rooms...</p>
        </div>
      )
  }

  return (
    <ScrollArea className="h-full">
        <div className="p-4 md:p-6">
            {!userHasRoom && (
                 <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-lg mb-6">
                    <h2 className="text-2xl font-bold mb-2">Voice Rooms</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Create a room to talk with friends, host events, or just hang out.
                    </p>
                    <Button size="lg" className="py-6 px-8 text-lg" asChild>
                        <Link href="/chat/rooms/create">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Create Your Room
                        </Link>
                    </Button>
                </div>
            )}
           
            {rooms.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {rooms.map(room => (
                        <RoomCard key={room.id} room={room} />
                    ))}
                </div>
            ) : userHasRoom === false ? (
                 <div className="text-center text-muted-foreground mt-8">
                    <p>No active rooms right now. Why not create one?</p>
                </div>
            ) : null}
        </div>
    </ScrollArea>
  );
}
