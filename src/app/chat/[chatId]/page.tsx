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
  writeBatch,
  updateDoc,
  arrayUnion,
  increment,
  limit,
  where,
  Timestamp,
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
  X,
  Reply,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Message as MessageType, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { ContactProfileSheet } from '@/components/chat/contact-profile-sheet';
import Link from 'next/link';

// Helper to get or create a chat
async function getOrCreateChat(
  firestore: any,
  currentUser: UserProfile,
  otherUser: UserProfile
) {
  const chatId = [currentUser.uid, otherUser.uid].sort().join('_');
  const chatRef = doc(firestore, 'chats', chatId);
  
  try {
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
        const batch = writeBatch(firestore);

        // 1. Create the chat document
        const chatData = {
            members: [currentUser.uid, otherUser.uid],
            createdAt: serverTimestamp(),
            participantDetails: {
                [currentUser.uid]: {
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL,
                },
                [otherUser.uid]: {
                    displayName: otherUser.displayName,
                    photoURL: otherUser.photoURL,
                }
            },
            // Initialize unread counts
            unreadCount: {
                [currentUser.uid]: 0,
                [otherUser.uid]: 0,
            }
        };
        batch.set(chatRef, chatData);
        
        // 2. Add chatId to both users' profiles
        const currentUserRef = doc(firestore, 'users', currentUser.uid);
        const otherUserRef = doc(firestore, 'users', otherUser.uid);
        batch.update(currentUserRef, { chatIds: arrayUnion(chatId) });
        batch.update(otherUserRef, { chatIds: arrayUnion(chatId) });

        await batch.commit();
    }
    return chatId;
  } catch (serverError: any) {
     if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: chatRef.path,
            operation: 'get', 
        });
        errorEmitter.emit('permission-error', permissionError);
     } else {
        throw serverError; 
     }
     return null;
  }
}

export default function ChatIdPage({
  params,
}: {
  params: { chatId: string }; // chatId is the OTHER user's ID
}) {
  const { chatId: otherUserId } = React.use(params);
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [chatId, setChatId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<MessageType | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeTargetRef = useRef<HTMLDivElement | null>(null);
  const SWIPE_THRESHOLD = 50; // Minimum pixels for a swipe


  // Swipe to go back logic
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.targetTouches[0].clientX;
      touchEndX.current = e.targetTouches[0].clientX; // Reset on new touch
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (touchStartX.current < 50 && touchEndX.current > touchStartX.current + 100) {
        router.back();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [router]);

  // Fetch users' profiles and determine chat ID
  useEffect(() => {
    if (!firestore || !authUser || !otherUserId) return;

    const fetchProfilesAndSetupChat = async () => {
        setLoading(true);
        try {
            const currentUserDocRef = doc(firestore, 'users', authUser.uid);
            const otherUserDocRef = doc(firestore, 'users', otherUserId);

            const [currentUserSnap, otherUserSnap] = await Promise.all([
                getDoc(currentUserDocRef),
                getDoc(otherUserDocRef)
            ]);

            if (!currentUserSnap.exists() || !otherUserSnap.exists()) {
                toast({ title: 'Error', description: 'User not found.', variant: 'destructive' });
                router.push('/chat');
                return;
            }
            
            const currentUserData = currentUserSnap.data() as UserProfile;
            const otherUserData = otherUserSnap.data() as UserProfile;

            setCurrentUser(currentUserData);
            setOtherUser(otherUserData);

            const determinedChatId = await getOrCreateChat(firestore, currentUserData, otherUserData);
            if (determinedChatId) {
                setChatId(determinedChatId);
            }
        } catch (error: any) {
            console.error("Error setting up chat page:", error);
            const permissionError = new FirestorePermissionError({ path: `users/${authUser.uid}`, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
            toast({ title: 'Error', description: 'Could not initialize chat.', variant: 'destructive' });
        }
    };
    
    fetchProfilesAndSetupChat();
    
    // Real-time listener for other user's profile changes (like online status)
    const unsubscribeUser = onSnapshot(doc(firestore, 'users', otherUserId), (docSnap) => {
      if (docSnap.exists()) {
        setOtherUser(docSnap.data() as UserProfile);
      }
    });

    return () => unsubscribeUser();

  }, [firestore, authUser, otherUserId, router, toast]);

  // Real-time listener for messages
  useEffect(() => {
    if (!firestore || !chatId || !currentUser) return;

    setLoading(true);
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const chatClearedTimestamp = currentUser?.chatsCleared?.[chatId] ?? null;

    let q = query(messagesRef, orderBy('timestamp', 'asc'));
    if (chatClearedTimestamp) {
        q = query(q, where('timestamp', '>', chatClearedTimestamp));
    }


    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as MessageType)
      );
      setMessages(msgs);
      setLoading(false);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: messagesRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, chatId, currentUser]);

  // Mark messages as read and reset unread count
  useEffect(() => {
    if (!firestore || !chatId || !authUser) return;
    
    const unreadMessages = messages.filter(
        (msg) => msg.status !== 'read' && msg.senderId !== authUser.uid
    );

    if (unreadMessages.length > 0) {
        const batch = writeBatch(firestore);
        unreadMessages.forEach((msg) => {
            if(msg.id){
                const msgRef = doc(firestore, 'chats', chatId, 'messages', msg.id);
                batch.update(msgRef, { status: 'read' });
            }
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

    // Reset this user's unread count in the chat document
    const chatRef = doc(firestore, 'chats', chatId);
    const unreadCountReset: { [key: string]: any } = {};
    unreadCountReset[`unreadCount.${authUser.uid}`] = 0;
    
    updateDoc(chatRef, unreadCountReset).catch(serverError => {
        // This might fail if the user is offline, but it's not critical
        console.warn("Could not reset unread count:", serverError);
    });

  }, [messages, firestore, chatId, authUser]);
  
   useEffect(() => {
    // Scroll to bottom when messages change
    if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
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
    if (inputValue.trim() === '' || !firestore || !authUser || !chatId || !otherUser) return;

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const chatRef = doc(firestore, 'chats', chatId);
    
    const contentToSend = inputValue.trim();
    setInputValue(''); // Clear input immediately for better UX
    
    const isOtherUserOnline = otherUser?.isOnline ?? false;

    const newMessage: any = {
      senderId: authUser.uid,
      content: contentToSend,
      timestamp: serverTimestamp(),
      type: 'text' as const,
      status: isOtherUserOnline ? 'delivered' : 'sent'
    };
    
    if (replyToMessage) {
        newMessage.replyTo = {
            messageId: replyToMessage.id,
            content: replyToMessage.content,
            senderId: replyToMessage.senderId,
        };
        setReplyToMessage(null); // Reset reply state after sending
    }

    addDoc(messagesRef, newMessage).catch((serverError) => {
        toast({
          title: "Error Sending Message",
          description: "Could not send your message. Please try again.",
          variant: "destructive",
        });

        const permissionError = new FirestorePermissionError({
            path: messagesRef.path,
            operation: 'create',
            requestResourceData: newMessage,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    
    const lastMessageData = {
        content: newMessage.content,
        timestamp: serverTimestamp(),
        senderId: newMessage.senderId
    };
    
    // Increment unread count for the other user
    const unreadCountUpdate: { [key: string]: any } = {
        lastMessage: lastMessageData
    };
    unreadCountUpdate[`unreadCount.${otherUser.uid}`] = increment(1);


    updateDoc(chatRef, unreadCountUpdate).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: chatRef.path,
            operation: 'update',
            requestResourceData: { lastMessage: lastMessageData },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        handleSendMessage();
    }
  };
  
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, msg: MessageType) => {
        swipeTargetRef.current = e.currentTarget;
        touchStartX.current = e.targetTouches[0].clientX;
        touchEndX.current = e.targetTouches[0].clientX; // Reset on new touch
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!swipeTargetRef.current) return;
        const currentX = e.targetTouches[0].clientX;
        const diffX = currentX - touchStartX.current;
        touchEndX.current = currentX;
        
        // Only allow swiping right, and not too far
        if (diffX > 0 && diffX < 100) {
            swipeTargetRef.current.style.transform = `translateX(${diffX}px)`;
        }
    };

    const handleTouchEnd = (msg: MessageType) => {
        if (!swipeTargetRef.current) return;

        const diffX = touchEndX.current - touchStartX.current;

        if (diffX > SWIPE_THRESHOLD) {
            // Successful swipe
            setReplyToMessage(msg);
            inputRef.current?.focus();
        }

        // Reset style
        swipeTargetRef.current.style.transform = 'translateX(0)';
        swipeTargetRef.current = null;
    };
  
  const MessageStatus = ({ status }: { status: MessageType['status'] }) => {
    if (status === 'read') {
      return <CheckCheck className="h-4 w-4 text-sky-500" />;
    }
    if (status === 'delivered') {
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
    }
    return <Check className="h-4 w-4 text-muted-foreground" />;
  };
  
  const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'p'); // e.g., 12:00 PM
  };

  const formatLastSeen = (timestamp: any) => {
      if (!timestamp) return 'Offline';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return `Last seen at ${format(date, 'p')}`; // e.g., Last seen at 10:30 PM
  };
  
  if (loading || !otherUser || !authUser) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center">
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
    <div className="flex h-dvh flex-col bg-background">
       {/* Chat Header */}
        <header className="flex shrink-0 items-center gap-4 border-b bg-muted/40 px-4 py-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => router.push('/chat')}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
            </Button>
            <div 
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => setContactSheetOpen(true)}
            >
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
            </div>
            <div className="flex flex-1 justify-end items-center gap-2">
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
                 <DropdownMenuItem asChild>
                    <Link href={`/chat/${otherUserId}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>More settings</span>
                    </Link>
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
        </header>

      {/* Messages Area */}
       <main className="flex-1 overflow-y-auto" ref={viewportRef}>
          <div className="space-y-2 p-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.senderId === authUser?.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="relative transition-transform duration-200 ease-out"
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(msg)}
                >
                  <div
                    className={`flex max-w-xs flex-col rounded-lg px-3 py-2 text-sm lg:max-w-md ${
                      msg.senderId === authUser?.uid
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.replyTo && (
                      <div className="mb-1 rounded-md border-l-2 border-primary-foreground/50 bg-black/10 p-2">
                        <p className="font-bold text-xs">
                          {msg.replyTo.senderId === authUser.uid ? 'You' : otherUser.displayName.split(' ')[0]}
                        </p>
                        <p className="truncate text-xs opacity-80">{msg.replyTo.content}</p>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                        <p className="whitespace-pre-wrap flex-shrink">{msg.content}</p>
                        <div className={`flex items-center gap-1 text-[10px] ${ msg.senderId === authUser?.uid ? 'text-primary-foreground/70' : 'text-muted-foreground' }`}>
                            <span>{formatTimestamp(msg.timestamp)}</span>
                            {msg.senderId === authUser?.uid && (
                                <MessageStatus status={msg.status} />
                            )}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

      {/* Message Input */}
      <footer className="shrink-0 border-t bg-muted/40">
        {replyToMessage && (
          <div className="flex items-center justify-between bg-muted p-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <Reply className="h-4 w-4 flex-shrink-0" />
              <div className="overflow-hidden">
                <p className="truncate font-bold text-sm">
                  Replying to{' '}
                  {replyToMessage.senderId === authUser.uid
                    ? 'yourself'
                    : otherUser.displayName.split(' ')[0]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {replyToMessage.content}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setReplyToMessage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="relative flex items-center p-2">
          <Button variant="ghost" size="icon" className="absolute bottom-3 left-3">
            <Smile className="h-5 w-5" />
            <span className="sr-only">Emoji</span>
          </Button>
          <Textarea
            ref={inputRef}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-[120px] resize-none rounded-full border-2 border-input bg-transparent py-2 pl-12 pr-28 shadow-sm focus:border-primary focus:ring-primary"
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
          <div className="absolute bottom-3 right-3 flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Mic className="h-5 w-5" />
              <span className="sr-only">Record voice message</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSendMessage}
            >
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
