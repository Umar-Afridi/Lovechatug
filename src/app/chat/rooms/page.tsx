'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users, Search as SearchIcon, Star, Tv } from 'lucide-react';
import type { Room } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { cn } from '@/lib/utils';

export default function RoomsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch My Rooms (created by the current user)
  useEffect(() => {
    if (!firestore || !user) return;
    const roomsRef = collection(firestore, 'rooms');
    const q = query(roomsRef, where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubMyRooms = onSnapshot(q, (snapshot) => {
      const userRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setMyRooms(userRooms);
    }, (error) => {
        console.error("Error fetching user's rooms: ", error);
        const permissionError = new FirestorePermissionError({path: 'rooms', operation: 'list'}, error);
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubMyRooms();
  }, [firestore, user]);

  // Fetch Public/Popular Rooms
  useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    const roomsRef = collection(firestore, 'rooms');
    const q = query(roomsRef, orderBy('memberCount', 'desc'), orderBy('createdAt', 'desc'));

    const unsubPublicRooms = onSnapshot(q, (snapshot) => {
      const allRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setPublicRooms(allRooms);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching popular rooms: ", error);
        const permissionError = new FirestorePermissionError({path: 'rooms', operation: 'list'}, error);
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubPublicRooms();
  }, [firestore]);
  
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'R';
  
  const filteredRooms = publicRooms.filter(room => 
      room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRoomList = (title: string, rooms: Room[], icon?: React.ReactNode) => (
    <div className="space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 px-4">{icon}{title}</h2>
        {rooms.length === 0 ? (
            <p className="text-muted-foreground px-4 text-sm">No rooms found.</p>
        ) : (
            <div className="relative">
                <div className="flex space-x-4 overflow-x-auto p-4 scrollbar-hide">
                    {rooms.map(room => (
                         <Link key={room.id} href={`/chat/rooms/${room.id}`} className="block flex-shrink-0 w-40">
                             <div className="space-y-2 group">
                                 <div className="relative">
                                     <Avatar className="w-40 h-40 rounded-xl shadow-md group-hover:ring-2 group-hover:ring-primary transition-all">
                                         <AvatarImage src={room.photoURL} />
                                         <AvatarFallback className="text-3xl rounded-xl">{getInitials(room.name)}</AvatarFallback>
                                     </Avatar>
                                     <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs font-bold p-1 rounded-md flex items-center gap-1">
                                         <Users className="h-3 w-3" />
                                         <span>{room.memberCount || 0}</span>
                                     </div>
                                     {room.ownerIsOfficial && (
                                         <div className="absolute top-2 left-2">
                                            <OfficialBadge color="gold" size="icon" className="h-6 w-6"/>
                                         </div>
                                     )}
                                 </div>
                                 <p className="font-semibold truncate text-center">{room.name}</p>
                             </div>
                        </Link>
                    ))}
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">Voice Chat Rooms</h1>
        <Button size="sm" asChild>
            <Link href="/chat/rooms/create">
                <Plus className="mr-2 h-4 w-4" /> Create Room
            </Link>
        </Button>
      </div>
      
      <div className="p-4 border-b">
        <div className="relative">
            <Input 
                placeholder="Search for rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
             <div className="p-4 space-y-4">
                 <div className="h-8 w-1/3 bg-muted rounded-md animate-pulse"></div>
                 <div className="flex space-x-4">
                     {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-2">
                           <div className="w-40 h-40 bg-muted rounded-xl animate-pulse"></div>
                           <div className="h-5 w-32 bg-muted rounded-md animate-pulse mx-auto"></div>
                        </div>
                     ))}
                 </div>
             </div>
        ) : searchQuery ? (
            renderRoomList("Search Results", filteredRooms)
        ) : (
          <div className="space-y-8 py-4">
            {myRooms.length > 0 && renderRoomList("My Rooms", myRooms, <Star className="text-yellow-500 h-6 w-6"/>)}
            {renderRoomList("Popular Rooms", publicRooms, <Tv className="text-purple-500 h-6 w-6"/>)}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Helper for horizontal scrolling without visible scrollbar
const style = document.createElement('style');
style.innerHTML = `.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`;
document.head.appendChild(style);
