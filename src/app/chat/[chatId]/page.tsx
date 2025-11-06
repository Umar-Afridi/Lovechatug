'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  where,
  getDocs,
  writeBatch,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import {
  Phone,
  Video,
  MoreVertical,
  Mic,
  Send,
  Smile,
  Paperclip,
  ArrowLeft,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import type { Message as MessageType, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Helper to get or create a chat
async function getOrCreateChat(
  firestore: any,
  currentUserId: string,
  otherUserId: string
) {
  const chatId = [currentUserId, otherUserId].sort().join('_');
  const chatRef = doc(firestore, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    const chatData = {
        members: [currentUserId, otherUserId],
        createdAt: serverTimestamp(),
    };
    // Create chat if it doesn't exist
    setDoc(chatRef, chatData).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: chatRef.path,
            operation: 'create',
            requestResourceData: chatData,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }
  return chatId;
}

export default function ChatIdPage({
  params: paramsProp,
}: {
  params: { chatId: string }; // chatId is the OTHER user's ID
}) {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const otherUserId = React.use(paramsProp as any).chatId;

  const [chatId, setChatId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch other user's profile and determine chat ID
  useEffect(() => {
    if (!firestore || !user || !otherUserId) return;

    const performSetup = async () => {
      setLoading(true);
      try {
        // Fetch other user's profile
        const userDocRef = doc(firestore, 'users', otherUserId);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          setOtherUser(docSnap.data() as UserProfile);
        } else {
          toast({ title: 'Error', description: 'User not found.', variant: 'destructive' });
          router.push('/chat');
          return;
        }

        // Get or create the chat and set the ID
        const determinedChatId = await getOrCreateChat(firestore, user.uid, otherUserId);
        setChatId(determinedChatId);
      } catch (error) {
        // This catch block is for general errors, not permission errors which are handled in getOrCreateChat
        console.error("Error setting up chat page:", error);
        toast({ title: 'Error', description: 'Could not initialize chat.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    
    performSetup();

  }, [firestore, user, otherUserId, router, toast]);

  // Real-time listener for messages
  useEffect(() => {
    if (!firestore || !chatId) return;

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as MessageType)
      );
      setMessages(msgs);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: messagesRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore, chatId]);
  
   useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if(viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || !firestore || !user || !chatId) return;

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const chatRef = doc(firestore, 'chats', chatId);
    
    const newMessage = {
      senderId: user.uid,
      content: inputValue.trim(),
      timestamp: serverTimestamp(),
      type: 'text' as const,
    };
    
    const lastMessageData = {
        content: newMessage.content,
        timestamp: serverTimestamp(),
        senderId: newMessage.senderId
    };

    addDoc(messagesRef, newMessage).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: messagesRef.path,
            operation: 'create',
            requestResourceData: newMessage,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    
    updateDoc(chatRef, { lastMessage: lastMessageData }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: chatRef.path,
            operation: 'update',
            requestResourceData: { lastMessage: lastMessageData },
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };
  
  if (loading || !otherUser) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-lg">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
       <div className="md:hidden p-2 border-b">
         <Button variant="ghost" size="icon" onClick={() => router.push('/chat')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
       </div>
       {/* Chat Header */}
        <header className="flex items-center gap-4 border-b bg-muted/40 px-6 py-3">
            <Avatar>
            <AvatarImage src={otherUser.photoURL} />
            <AvatarFallback>{getInitials(otherUser.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
            <p className="font-semibold">{otherUser.displayName}</p>
            </div>
            <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
                <Phone className="h-5 w-5" />
                <span className="sr-only">Audio Call</span>
            </Button>
            <Button variant="ghost" size="icon">
                <Video className="h-5 w-5" />
                <span className="sr-only">Video Call</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">More options</span>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem>View Contact</DropdownMenuItem>
                <Separator />
                <DropdownMenuItem className="text-destructive">
                    Block User
                </DropdownMenuItem>
                <DropdownMenuItem>Clear Chat</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            </div>
        </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-6 space-y-4">
            {messages.map((msg) => (
                 <div
                    key={msg.id}
                    className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-xs rounded-lg px-4 py-2 text-sm lg:max-w-md ${
                            msg.senderId === user?.uid
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                    >
                        {msg.content}
                    </div>
                </div>
            ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <footer className="border-t bg-muted/40 p-4">
        <div className="relative flex items-center">
          <Button variant="ghost" size="icon" className="absolute left-1">
            <Smile className="h-5 w-5" />
            <span className="sr-only">Emoji</span>
          </Button>
          <Input 
            placeholder="Type a message..." 
            className="pl-12 pr-24"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <div className="absolute right-1 flex items-center">
            <Button variant="ghost" size="icon">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
             <Button variant="ghost" size="icon">
              <Mic className="h-5 w-5" />
              <span className="sr-only">Record voice message</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSendMessage}>
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
