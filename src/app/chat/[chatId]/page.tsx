'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  where,
  Timestamp,
  getDocs,
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
  Trash2,
  Lock,
  ArrowUp,
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
import { cn } from '@/lib/utils';

// Custom interval hook
const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef<() => void>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};


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
  const { chatId: otherUserIdFromParams } = React.use(params);
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

  // Voice message states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const touchStartX = useRef(0);
  const touchMoveX = useRef(0);
  
  // Swipe to go back logic for mobile
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if touch starts near the left edge
      if (e.targetTouches[0].clientX < 50) {
        touchStartX.current = e.targetTouches[0].clientX;
        touchMoveX.current = e.targetTouches[0].clientX;
      } else {
        touchStartX.current = 0; // Reset if touch starts elsewhere
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartX.current > 0) { // Only track movement if touch started on the edge
        touchMoveX.current = e.targetTouches[0].clientX;
      }
    };

    const handleTouchEnd = () => {
      // If swipe started on the edge and moved significantly to the right
      if (touchStartX.current > 0 && touchMoveX.current > touchStartX.current + 100) {
        router.back();
      }
      // Reset for the next touch
      touchStartX.current = 0;
      touchMoveX.current = 0;
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
    if (!firestore || !authUser || !otherUserIdFromParams) return;

    const fetchProfilesAndSetupChat = async () => {
        setLoading(true);
        try {
            const currentUserDocRef = doc(firestore, 'users', authUser.uid);
            const otherUserDocRef = doc(firestore, 'users', otherUserIdFromParams);

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
    const otherUserDocRef = doc(firestore, 'users', otherUserIdFromParams);
    const unsubscribeUser = onSnapshot(otherUserDocRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            setOtherUser(docSnap.data() as UserProfile);
          }
        },
        (error) => {
            const permissionError = new FirestorePermissionError({
                path: otherUserDocRef.path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
            console.error("Error fetching other user's profile:", error);
        }
    );

    return () => unsubscribeUser();

  }, [firestore, authUser, otherUserIdFromParams, router, toast]);

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
  
  const prevOtherUserIsOnline = useRef(otherUser?.isOnline);
  // Update sent messages to delivered when the other user comes online
  useEffect(() => {
    if (!firestore || !chatId || !authUser || !otherUser) return;

    // Check if the user just came online
    if (otherUser.isOnline && !prevOtherUserIsOnline.current) {
      const messagesRef = collection(firestore, 'chats', chatId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '==', authUser.uid),
        where('status', '==', 'sent')
      );

      getDocs(q).then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const batch = writeBatch(firestore);
          querySnapshot.forEach((doc) => {
            batch.update(doc.ref, { status: 'delivered' });
          });
          batch.commit().catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: messagesRef.path,
                operation: 'update',
                requestResourceData: { status: 'delivered' }
            });
            errorEmitter.emit('permission-error', permissionError);
          });
        }
      });
    }

    // Update the ref for the next render
    prevOtherUserIsOnline.current = otherUser.isOnline;
  }, [otherUser, firestore, chatId, authUser]);
  
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
  
    useInterval(
        () => {
        if (recordingStartTime) {
            setRecordingDuration(Date.now() - recordingStartTime);
        }
        },
        isRecording ? 1000 : null
    );

    const formatRecordingTime = (duration: number) => {
        const seconds = Math.floor((duration / 1000) % 60);
        const minutes = Math.floor((duration / (1000 * 60)) % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        if (isRecording) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsRecording(true);
            setRecordingStartTime(Date.now());
            setRecordingDuration(0);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            mediaRecorderRef.current.start();
        } catch (error) {
            console.error("Error starting recording:", error);
            toast({ title: "Microphone Access Denied", description: "Please grant microphone access to record audio.", variant: "destructive"});
            setIsRecording(false);
            setRecordingStartTime(null);
        }
    };
    
    const stopRecording = useCallback(async (send: boolean) => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            setIsRecording(false);
            return;
        }

        return new Promise<void>((resolve) => {
            mediaRecorderRef.current!.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
                
                if (send && audioBlob.size > 100) {
                    await sendAudioMessage(audioBlob);
                }
                
                audioChunksRef.current = [];
                mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
                
                setIsRecording(false);
                setRecordingStartTime(null);
                setRecordingDuration(0);
                resolve();
            };
            
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        });
    }, [chatId, authUser, otherUser, firestore]);

    const sendAudioMessage = async (audioBlob: Blob) => {
        if (!firestore || !chatId || !authUser || !otherUser || audioBlob.size === 0) return;
    
        const storage = getStorage();
        const audioFileRef = storageRef(storage, `chats/${chatId}/${Date.now()}.webm`);

        try {
            toast({ title: 'Uploading voice message...' });
            const snapshot = await uploadBytes(audioFileRef, audioBlob);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const messagesRef = collection(firestore, 'chats', chatId, 'messages');
            const newAudioMessage = {
                senderId: authUser.uid,
                content: 'Voice message',
                timestamp: serverTimestamp(),
                type: 'audio' as const,
                mediaUrl: downloadURL,
                status: otherUser.isOnline ? 'delivered' : 'sent',
            };
            
            await addDoc(messagesRef, newAudioMessage);

            const chatRef = doc(firestore, 'chats', chatId);
            const lastMessageData = {
                content: '🎤 Voice message',
                timestamp: serverTimestamp(),
                senderId: authUser.uid
            };
            
            const unreadCountUpdate: { [key: string]: any } = { lastMessage: lastMessageData };
            unreadCountUpdate[`unreadCount.${otherUser.uid}`] = increment(1);
            await updateDoc(chatRef, unreadCountUpdate);

        } catch (error) {
            console.error("Error sending audio message:", error);
            toast({ title: 'Error', description: 'Could not send voice message.', variant: 'destructive' });
        }
    };

    const handleMicButtonPress = () => {
        if(inputValue.trim()) return;
        startRecording();
    };

    const handleMicButtonRelease = () => {
        if (isRecording) {
            stopRecording(true);
        }
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
  
    const handleReplyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchMoveX.current = e.targetTouches[0].clientX;
    };

    const handleReplyTouchMove = (e: React.TouchEvent<HTMLDivElement>, target: HTMLDivElement) => {
        if (!target) return;
        const currentX = e.targetTouches[0].clientX;
        const diffX = currentX - touchStartX.current;
        touchMoveX.current = currentX;
        
        // Only allow swiping right, and not too far
        if (diffX > 0 && diffX < 100) {
            target.style.transform = `translateX(${diffX}px)`;
        }
    };

    const handleReplyTouchEnd = (msg: MessageType, target: HTMLDivElement) => {
        if (!target) return;

        const diffX = touchMoveX.current - touchStartX.current;

        if (diffX > 50) { // Swipe threshold
            setReplyToMessage(msg);
            inputRef.current?.focus();
        }

        // Reset style
        target.style.transform = 'translateX(0)';
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
      // Format to time like "10:30 PM"
      return `Last seen at ${format(date, 'p')}`;
  };
  
  if (loading || !otherUser || !authUser) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-lg">Loading chat...</p>
      </div>
    );
  }
  
    const renderMessageContent = (msg: MessageType) => {
        switch (msg.type) {
            case 'text':
                return <p className="whitespace-pre-wrap flex-shrink">{msg.content}</p>;
            case 'audio':
                return (
                    <audio controls src={msg.mediaUrl} className="max-w-full">
                        Your browser does not support the audio element.
                    </audio>
                );
            case 'image':
                 return msg.mediaUrl ? <img src={msg.mediaUrl} alt="sent image" className="rounded-lg max-w-full" /> : <p>Image not available</p>;
            default:
                return null;
        }
    };

  return (
    <>
      <ContactProfileSheet 
          isOpen={isContactSheetOpen} 
          onOpenChange={setContactSheetOpen}
          userProfile={otherUser}
      />
      <div className="h-screen flex flex-col bg-background">
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
              <div className="ml-auto flex items-center gap-2">
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
                      <Link href={`/chat/${otherUserIdFromParams}/settings`}>
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
              {messages.map((msg) => {
                const messageRef = React.createRef<HTMLDivElement>();
                return (
                    <div
                    key={msg.id}
                    className={`flex w-full ${msg.senderId === authUser?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                    <div
                        className="relative transition-transform duration-200 ease-out"
                        ref={messageRef}
                        onTouchStart={(e) => handleReplyTouchStart(e)}
                        onTouchMove={(e) => messageRef.current && handleReplyTouchMove(e, messageRef.current)}
                        onTouchEnd={() => messageRef.current && handleReplyTouchEnd(msg, messageRef.current)}
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
                             {renderMessageContent(msg)}
                            <div className={`flex items-center gap-1 text-[10px] shrink-0 self-end ${ msg.senderId === authUser?.uid ? 'text-primary-foreground/70' : 'text-muted-foreground' }`}>
                                <span>{formatTimestamp(msg.timestamp)}</span>
                                {msg.senderId === authUser?.uid && (
                                    <MessageStatus status={msg.status} />
                                )}
                            </div>
                        </div>
                        </div>
                    </div>
                    </div>
                );
            })}
            </div>
          </main>

        {/* Message Input */}
        <footer className="shrink-0 border-t bg-muted/40 p-4">
            {isRecording ? (
                <div className="flex items-center gap-4 w-full">
                    <div className="flex-1 flex items-center justify-center gap-2 text-destructive font-mono bg-destructive/10 rounded-full px-3 py-1">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                        </span>
                        <span>{formatRecordingTime(recordingDuration)}</span>
                    </div>
                     <Button
                        size="icon"
                        className="rounded-full h-12 w-12 shrink-0"
                        onClick={handleMicButtonRelease}
                    >
                        <Send className="h-6 w-6" />
                        <span className="sr-only">Send</span>
                    </Button>
                </div>
            ) : (
                <div className="relative">
                    {replyToMessage && (
                    <div className="flex items-center justify-between bg-muted p-2 rounded-t-md">
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
                    <div className="flex items-end gap-2">
                        <div className="relative w-full">
                             <Textarea
                                ref={inputRef}
                                placeholder="Type a message..."
                                className="min-h-[48px] max-h-[120px] resize-none rounded-2xl border-2 border-input bg-transparent py-3 px-12 shadow-sm focus:border-primary focus:ring-primary"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                rows={1}
                                onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                                }}
                            />
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
                                <Button variant="ghost" size="icon" className="shrink-0">
                                    <Smile className="h-6 w-6" />
                                    <span className="sr-only">Emoji</span>
                                </Button>
                            </div>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                                <Button variant="ghost" size="icon" className="shrink-0">
                                    <Paperclip className="h-6 w-6" />
                                    <span className="sr-only">Attach file</span>
                                </Button>
                            </div>
                        </div>
                         <Button
                            size="icon"
                            className="rounded-full h-12 w-12 shrink-0"
                            onClick={() => {
                                if (inputValue.trim()) {
                                    handleSendMessage();
                                }
                            }}
                            onMouseDown={handleMicButtonPress}
                            onMouseUp={handleMicButtonRelease}
                            onTouchStart={handleMicButtonPress}
                            onTouchEnd={handleMicButtonRelease}
                        >
                            {inputValue.trim() ? <Send className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                            <span className="sr-only">{inputValue.trim() ? "Send" : "Record voice message"}</span>
                        </Button>
                    </div>
                </div>
            )}
        </footer>
      </div>
    </>
  );
}
