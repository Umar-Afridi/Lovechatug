'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Home } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Room } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';

const RoomCard = ({ room }: { room: Room }) => {
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'R';
  return (
    <Link href={`/chat/rooms/${room.id}`} className="block">
      <div className="border rounded-lg p-4 flex flex-col items-center gap-3 text-center hover:bg-muted/50 transition-colors h-full">
        <Avatar className="h-20 w-20 border">
          <AvatarImage src={room.photoURL} />
          <AvatarFallback className="text-2xl bg-muted">{getInitials(room.name)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1 flex-1 flex flex-col justify-center">
          <h3 className="font-semibold truncate leading-tight">{room.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
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
    const [myRoom, setMyRoom] = useState<Room | null>(null);
    const [publicRooms, setPublicRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) {
            setLoading(false);
            return;
        }

        // Listener for the user's own room
        const myRoomQuery = query(collection(firestore, 'rooms'), where("ownerId", "==", user.uid));
        const unsubMyRoom = onSnapshot(myRoomQuery, 
            (snapshot) => {
                if (!snapshot.empty) {
                    const roomData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Room;
                    setMyRoom(roomData);
                } else {
                    setMyRoom(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching user's room: ", error);
                const permissionError = new FirestorePermissionError({path: `rooms query for user ${user.uid}`, operation: 'list'});
                errorEmitter.emit('permission-error', permissionError);
                setLoading(false);
            }
        );
        
        // Listener for all other public rooms
        const publicRoomsQuery = query(collection(firestore, 'rooms'), where("ownerId", "!=", user.uid));
        const unsubPublicRooms = onSnapshot(publicRoomsQuery,
            (snapshot) => {
                const rooms = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Room);
                setPublicRooms(rooms);
            },
            (error) => {
                 console.error("Error fetching public rooms: ", error);
                 const permissionError = new FirestorePermissionError({path: 'rooms', operation: 'list'});
                 errorEmitter.emit('permission-error', permissionError);
            }
        );
        
        return () => {
            unsubMyRoom();
            unsubPublicRooms();
        };
    }, [firestore, user]);

  if (loading) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="text-muted-foreground">Loading rooms...</p>
        </div>
      )
  }

  return (
    <ScrollArea className="h-full">
        <div className="p-4 md:p-6 space-y-6">
            <div className="bg-muted/30 rounded-lg p-6 text-center">
                 <h2 className="text-2xl font-bold mb-2">Voice Rooms</h2>
                 <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {myRoom 
                        ? "Jump back into your room or explore what others are talking about."
                        : "Create a room to talk with friends, host events, or just hang out."
                    }
                </p>
                 {myRoom ? (
                      <Button size="lg" className="py-6 px-8 text-lg" asChild>
                        <Link href={`/chat/rooms/${myRoom.id}`}>
                            <Home className="mr-2 h-5 w-5" />
                            My Room
                        </Link>
                    </Button>
                 ) : (
                    <Button size="lg" className="py-6 px-8 text-lg" asChild>
                        <Link href="/chat/rooms/create">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Create New Room
                        </Link>
                    </Button>
                 )}
            </div>

            {publicRooms.length > 0 && (
                <div>
                    <Separator className="my-6" />
                    <h3 className="text-xl font-bold mb-4 px-2">All Rooms</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {publicRooms.map(room => <RoomCard key={room.id} room={room} />)}
                    </div>
                </div>
            )}
        </div>
    </ScrollArea>
  );
}
