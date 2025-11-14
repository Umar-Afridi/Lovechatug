'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Home } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Room } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OfficialBadge } from '@/components/ui/official-badge';
import { ArrowLeft } from 'lucide-react';


const RoomCard = ({ room }: { room: Room }) => {
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'R';
  return (
    <Link href={`/chat/rooms/${room.id}`} className="block">
      <div className="border rounded-lg p-4 flex flex-col items-center gap-3 text-center hover:bg-muted/50 transition-colors h-full">
        <div className="relative">
          <Avatar className="h-20 w-20 border">
            <AvatarImage src={room.photoURL} />
            <AvatarFallback className="text-2xl bg-muted">{getInitials(room.name)}</AvatarFallback>
          </Avatar>
           {room.ownerIsOfficial && (
              <div className="absolute -top-1 -right-1">
                <OfficialBadge size="icon" className="h-6 w-6" />
              </div>
            )}
        </div>
        <div className="space-y-1 flex-1 flex flex-col justify-center">
          <h3 className="font-semibold truncate leading-tight">{room.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Users className="h-3 w-3" />
            {room.memberCount || 0} listening
          </p>
        </div>
      </div>
    </Link>
  )
};


export default function RoomsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [myRoom, setMyRoom] = useState<Room | null>(null);
    const [publicRooms, setPublicRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const roomsCollectionRef = collection(firestore, 'rooms');

        // Listener for all rooms to find the user's own room
        const myRoomQuery = query(roomsCollectionRef, where('ownerId', '==', user.uid));
        const unsubMyRoom = onSnapshot(myRoomQuery, (snapshot) => {
            if (!snapshot.empty) {
                const userRoom = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Room;
                setMyRoom(userRoom);
            } else {
                setMyRoom(null);
            }
        });

        // Listener for popular rooms
        // This query requires a composite index on ownerIsOfficial (desc) and memberCount (desc)
        const popularRoomsQuery = query(
            roomsCollectionRef,
            orderBy('ownerIsOfficial', 'desc'),
            orderBy('memberCount', 'desc')
        );

        const unsubPublicRooms = onSnapshot(popularRoomsQuery,
            (snapshot) => {
                const allPublicRooms = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Room))
                     // Also filter out empty rooms and own room on the client-side
                    .filter(room => room.ownerId !== user.uid && room.memberCount > 0);
                
                setPublicRooms(allPublicRooms);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching popular rooms: ", error);
                const permissionError = new FirestorePermissionError({path: 'rooms', operation: 'list'});
                errorEmitter.emit('permission-error', permissionError);
                setLoading(false);
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
    <div className="flex flex-col h-full bg-background">
       <Tabs defaultValue="my-room" className="flex flex-col flex-1">
            <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
                <TabsTrigger value="my-room">My Room</TabsTrigger>
                <TabsTrigger value="popular">Popular</TabsTrigger>
            </TabsList>
            <TabsContent value="my-room" className="flex-1 overflow-hidden mt-0">
                 <ScrollArea className="h-full">
                    <div className="p-4 md:p-6 text-center">
                        <div className="bg-muted/30 rounded-lg p-6">
                            <h2 className="text-2xl font-bold mb-2">
                                {myRoom ? 'Your Personal Room' : 'Create a Room'}
                            </h2>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                {myRoom 
                                    ? "This is your personal space. Jump back in anytime!"
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
                    </div>
                </ScrollArea>
            </TabsContent>
            <TabsContent value="popular" className="flex-1 overflow-hidden mt-0">
                 <ScrollArea className="h-full">
                    {publicRooms.length > 0 ? (
                         <div className="p-4 md:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {publicRooms.map(room => <RoomCard key={room.id} room={room} />)}
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                            <p className="text-muted-foreground">No popular rooms are active right now.</p>
                        </div>
                    )}
                </ScrollArea>
            </TabsContent>
        </Tabs>
    </div>
  );
}
