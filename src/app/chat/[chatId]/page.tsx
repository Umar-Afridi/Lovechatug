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
  arrayUnion,
  deleteDoc,
  arrayRemove,
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
  Check,
  CheckCheck,
  Settings,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import type { Message as MessageType, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { formatDistanceToNow } from 'date-fns';
import { ContactProfileSheet } from '@/components/chat/contact-profile-sheet';

// Helper to get or create a chat
async function getOrCreateChat(
  firestore: any,
  currentUserId: string,
  otherUserId: string
) {
  const chatId = [currentUserId, otherUserId].sort().join('_');
  const chatRef = doc(firestore, 'chats', chatId);
  
  try {
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      const chatData = {
          members: [currentUserId, otherUserId],
          createdAt: serverTimestamp(),
      };
      // Create chat if it doesn't exist
      await setDoc(chatRef, chatData);
    }
    return chatId;
  } catch (serverError: any) {
     if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: chatRef.path,
            operation: 'get', // The initial operation is a get
        });
        errorEmitter.emit('permission-error', permissionError);
     } else {
        throw serverError; // Re-throw other errors
     }
     return null;
  }
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
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // Fetch other user's profile and determine chat ID
  useEffect(() => {
    if (!firestore || !user || !otherUserId) return;

    // Real-time listener for other user's profile
    const userDocRef = doc(firestore, 'users', otherUserId);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setOtherUser(docSnap.data() as UserProfile);
      } else {
        toast({ title: 'Error', description: 'User not found.', variant: 'destructive' });
        router.push('/chat');
      }
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
        errorEmitter.emit('permission-error', permissionError);
    });

    const setupChat = async () => {
        setLoading(true);
        try {
            // Get or create the chat and set the ID
            const determinedChatId = await getOrCreateChat(firestore, user.uid, otherUserId);
            if (determinedChatId) {
                setChatId(determinedChatId);
            }
        } catch (error: any) {
            console.error("Error setting up chat page:", error);
            toast({ title: 'Error', description: 'Could not initialize chat.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };
    
    setupChat();

    return () => unsubscribeUser();

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

  // Mark messages as read
  useEffect(() => {
    if (!firestore || !chatId || !user) return;
    
    const unreadMessages = messages.filter(
        (msg) => msg.status !== 'read' && msg.senderId !== user.uid
    );

    if (unreadMessages.length > 0) {
        const batch = writeBatch(firestore);
        unreadMessages.forEach((msg) => {
            const msgRef = doc(firestore, 'chats', chatId, 'messages', msg.id);
            batch.update(msgRef, { status: 'read' });
        });
        
        batch.commit().catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: `chats/${chatId}/messages`,
                operation: 'update',
                requestResourceData: { status: 'read' }
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  }, [messages, firestore, chatId, user]);
  
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

  const handleSendMessage = () => {
    if (inputValue.trim() === '' || !firestore || !user || !chatId) return;

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const chatRef = doc(firestore, 'chats', chatId);
    
    const contentToSend = inputValue.trim();
    setInputValue(''); // Clear input immediately for better UX
    
    // Determine status based on other user's online status
    const isOtherUserOnline = otherUser?.isOnline ?? false;
    
    const newMessage = {
      senderId: user.uid,
      content: contentToSend,
      timestamp: serverTimestamp(),
      type: 'text' as const,
      status: isOtherUserOnline ? 'delivered' : 'sent'
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
    
    // Refocus the input to keep the keyboard open
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        handleSendMessage();
    }
  };
  
  const MessageStatus = ({ status }: { status: MessageType['status'] }) => {
    if (status === 'read') {
      return <CheckCheck className="h-4 w-4 text-sky-500" />;
    }
    if (status === 'delivered') {
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
    }
    // 'sent' status
    return <Check className="h-4 w-4 text-muted-foreground" />;
  };
  
  const formatLastSeen = (timestamp: any) => {
      if (!timestamp) return 'Offline';
      // Firestore server timestamp can be null before it's set, or it might be a Date object
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return `Last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
  };
  
  const handleBlockUser = async () => {
    if (!firestore || !user || !otherUserId) {
        toast({ title: "Error", description: "Cannot block user. Please try again.", variant: "destructive" });
        return;
    }

    const currentUserRef = doc(firestore, 'users', user.uid);

    try {
        await updateDoc(currentUserRef, {
            blockedUsers: arrayUnion(otherUserId)
        });
        
        toast({ title: "User Blocked", description: `${otherUser?.displayName} has been blocked.` });
        router.push('/chat');

    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: currentUserRef.path,
                operation: 'update',
                requestResourceData: { blockedUsers: arrayUnion(otherUserId) }
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error blocking user:", error);
            toast({ title: "Error", description: "Could not block user.", variant: "destructive" });
        }
    }
  };

  const handleUnfriend = async () => {
    if (!firestore || !user || !otherUserId || !chatId) {
      toast({ title: "Error", description: "Cannot unfriend user. Please try again.", variant: "destructive" });
      return;
    }
  
    const currentUserRef = doc(firestore, 'users', user.uid);
    const otherUserRef = doc(firestore, 'users', otherUserId);
    const chatRef = doc(firestore, 'chats', chatId);
  
    const batch = writeBatch(firestore);
  
    // Remove each other from friends lists
    batch.update(currentUserRef, { friends: arrayRemove(otherUserId) });
    batch.update(otherUserRef, { friends: arrayRemove(user.uid) });
  
    // Delete the chat document
    batch.delete(chatRef);
  
    try {
      await batch.commit();
      toast({ title: "Unfriended", description: `You are no longer friends with ${otherUser?.displayName}.` });
      router.push('/chat');
    } catch (error: any) {
       if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `batch operation for unfriend`,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error unfriending user:", error);
            toast({ title: "Error", description: "Could not unfriend user.", variant: "destructive" });
        }
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
    <>
    <ContactProfileSheet 
        isOpen={isContactSheetOpen} 
        onOpenChange={setContactSheetOpen}
        userProfile={otherUser}
    />
    <div className="flex h-screen flex-col">
       {/* Chat Header */}
        <header className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => router.push('/chat')}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
            </Button>
            <Avatar>
            <AvatarImage src={otherUser.photoURL} />
            <AvatarFallback>{getInitials(otherUser.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold">{otherUser.displayName.split(' ')[0]}</p>
               <p className="text-xs text-muted-foreground">
                  {otherUser.isOnline ? 'Online' : formatLastSeen(otherUser.lastSeen)}
               </p>
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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>More settings</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setContactSheetOpen(true)}>
                        View Contact
                      </DropdownMenuItem>
                      <Separator />
                      <DropdownMenuItem className="text-destructive" onClick={handleBlockUser}>
                        Block User
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={handleUnfriend}>
                        Unfriend
                      </DropdownMenuItem>
                      <DropdownMenuItem>Clear Chat</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
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
                    className={`flex items-end gap-2 ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-xs rounded-lg px-3 py-2 text-sm lg:max-w-md flex items-end gap-2 ${
                            msg.senderId === user?.uid
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                    >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                         {msg.senderId === user?.uid && (
                            <div className="flex-shrink-0">
                                <MessageStatus status={msg.status} />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <footer className="border-t bg-muted/40 p-4">
        <div className="relative flex items-center">
          <Button variant="ghost" size="icon" className="absolute left-1 bottom-3">
            <Smile className="h-5 w-5" />
            <span className="sr-only">Emoji</span>
          </Button>
          <Textarea 
            ref={inputRef}
            placeholder="Type a message..." 
            className="pl-12 pr-24 resize-none min-h-[40px] max-h-[120px] py-2"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
            onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
            }}
          />
          <div className="absolute right-1 bottom-1 flex items-center">
            <Button variant="ghost" size="icon">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>             <Button variant="ghost" size="icon">
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
    </>
  );
}
