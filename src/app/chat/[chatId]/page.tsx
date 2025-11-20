'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  setDoc,
  arrayRemove,
  deleteDoc,
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
  AlertCircle,
  Ban,
  DoorOpen,
  PhoneMissed,
  User as UserIcon,
  UserX,
  ShieldX,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Message as MessageType, UserProfile, Chat as ChatType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format, formatDistanceToNowStrict, differenceInHours, differenceInCalendarWeeks, differenceInCalendarMonths } from 'date-fns';
import { ContactProfileSheet } from '@/components/chat/contact-profile-sheet';
import Link from 'next/link';
import { useSound } from '@/hooks/use-sound';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { OfficialBadge } from '@/components/ui/official-badge';
import { useCallContext } from '../layout';
import { ClearChatDialog } from '@/components/chat/clear-chat-dialog';
import { DeleteMessageDialog } from '@/components/chat/delete-message-dialog';
import { applyNameColor } from '@/lib/utils';


export default function ChatIdPage() {
  const params = useParams();
  const otherUserIdFromParams = params.chatId as string;
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const callContext = useCallContext();
  
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatType | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);
  const [isClearChatDialogOpen, setClearChatDialogOpen] = useState(false);
  const [isDeleteMsgDialogOpen, setDeleteMsgDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<MessageType | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<MessageType | null>(null);

  // Block status state
  const [amIBlocked, setAmIBlocked] = useState(false);
  const [haveIBlocked, setHaveIBlocked] = useState(false);
  const isBlocked = useMemo(() => amIBlocked || haveIBlocked, [amIBlocked, haveIBlocked]);

  // --- Voice Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const touchStartX = useRef(0);
  const touchMoveX = useRef(0);
  const isDraggingReply = useRef(false);

  const { play: playReceiveMessageSound } = useSound('https://codeskulptor-demos.commondatastorage.googleapis.com/descent/gotitem.mp3');
  const { play: playSendMessageSound } = useSound('https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/sound/short_click.mp3');
  const isFirstMessageLoad = useRef(true);
  
  const isTyping = useMemo(() => chatData?.typing?.[otherUser?.uid ?? ''] === true, [chatData, otherUser]);

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


  // Determine Chat ID based on the new security rule
  useEffect(() => {
    if (!authUser || !otherUserIdFromParams) return;
    const determinedChatId = [authUser.uid, otherUserIdFromParams].sort().join('_');
    setChatId(determinedChatId);
  }, [authUser, otherUserIdFromParams]);

  // Fetch users' profiles, check block status
  useEffect(() => {
    if (!firestore || !authUser || !otherUserIdFromParams) return;

    setLoading(true);
    const currentUserDocRef = doc(firestore, 'users', authUser.uid);
    const otherUserDocRef = doc(firestore, 'users', otherUserIdFromParams);

    let unsubCurrentUser: (() => void) | null = null;
    let unsubOtherUser: (() => void) | null = null;

    const fetchProfiles = async () => {
        try {
            const currentUserSnap = await getDoc(currentUserDocRef);
            if (currentUserSnap.exists()) {
                const data = currentUserSnap.data() as UserProfile;
                setCurrentUser(data);
                setHaveIBlocked(data.blockedUsers?.includes(otherUserIdFromParams) ?? false);
            }

            const otherUserSnap = await getDoc(otherUserDocRef);
            if (otherUserSnap.exists()) {
                const otherUserData = otherUserSnap.data() as UserProfile;
                setOtherUser(otherUserData);
                setAmIBlocked(otherUserData.blockedUsers?.includes(authUser.uid) ?? false);
            } else {
                toast({ title: 'Error', description: 'User not found.', variant: 'destructive' });
                router.push('/chat');
                return;
            }

        } catch (error) {
            console.error("Error fetching user profiles:", error);
            const permissionError = new FirestorePermissionError({ path: `users`, operation: 'get' }, error as Error);
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setLoading(false);
        }
    };

    fetchProfiles();


    // Real-time listeners
    unsubCurrentUser = onSnapshot(currentUserDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setCurrentUser(data);
            setHaveIBlocked(data.blockedUsers?.includes(otherUserIdFromParams) ?? false);
        }
    }, (error) => console.error("Current user listener error:", error));

    unsubOtherUser = onSnapshot(otherUserDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const otherUserData = docSnap.data() as UserProfile;
            setOtherUser(otherUserData);
            setAmIBlocked(otherUserData.blockedUsers?.includes(authUser.uid) ?? false);
        }
    }, (error) => console.error("Other user listener error:", error));


    return () => {
      if (unsubCurrentUser) unsubCurrentUser();
      if (unsubOtherUser) unsubOtherUser();
    };

  }, [firestore, authUser, otherUserIdFromParams, router, toast]);

  // Real-time listener for chat document (for typing status)
  useEffect(() => {
      if (!firestore || !chatId) return;

      const chatRef = doc(firestore, 'chats', chatId);
      const unsubscribe = onSnapshot(chatRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as ChatType;
              setChatData(data);
          } else {
              setChatData(null);
          }
      }, (error) => {
          console.error("Error listening to chat document:", error);
           const permissionError = new FirestorePermissionError({ path: chatRef.path, operation: 'get' }, error);
           errorEmitter.emit('permission-error', permissionError);
      });

      return () => unsubscribe();
  }, [firestore, chatId]);

  // Real-time listener for messages
  useEffect(() => {
    if (!firestore || !chatId || !currentUser || amIBlocked) return;

    // We don't set loading to true here, loading is for initial page setup
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const chatClearedTimestamp = currentUser?.chatsCleared?.[chatId] ?? null;
    const deletedForMeIds = currentUser?.deletedMessages ?? [];
    
    let q = query(messagesRef, orderBy('timestamp', 'asc'));

    // If chat was cleared, only fetch messages after the cleared timestamp
    if (chatClearedTimestamp) {
        // Ensure we're creating a Firestore Timestamp object if it's not already one
        const clearedDate = chatClearedTimestamp.toDate ? chatClearedTimestamp.toDate() : new Date(chatClearedTimestamp);
        q = query(q, where('timestamp', '>', Timestamp.fromDate(clearedDate)));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const currentMessages = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as MessageType)
      ).filter(msg => !deletedForMeIds.includes(msg.id)); // Filter out messages deleted for the current user

      // Play sound for new incoming messages only after initial load
      if (!isFirstMessageLoad.current && currentMessages.length > messages.length) {
          const newMessage = currentMessages[currentMessages.length - 1];
          // Check if the new message is not from the current user
          if (newMessage && authUser && newMessage.senderId !== authUser.uid) {
              playReceiveMessageSound();
          }
      }
      
      setMessages(currentMessages);
      isFirstMessageLoad.current = false; // Mark initial load as complete
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `chats/${chatId}/messages`,
            operation: 'list',
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore, chatId, currentUser, authUser, amIBlocked, playReceiveMessageSound]);


  // Mark messages as read and reset unread count
  useEffect(() => {
    if (!firestore || !chatId || !authUser || isBlocked) return;
    
    const unreadMessages = messages.filter(
        (msg) => msg.status !== 'read' && msg.senderId !== authUser.uid
    );

    if (unreadMessages.length > 0) {
        const batch = writeBatch(firestore);
        unreadMessages.forEach((msg) => {
            if(msg.id && !msg.isUploading){ // Dont try to update local-only messages
                const msgRef = doc(firestore, 'chats', chatId, 'messages', msg.id);
                batch.update(msgRef, { status: 'read' });
            }
        });
        
        batch.commit().catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: `chats/${chatId}/messages`,
                operation: 'update',
                requestResourceData: { status: 'read' }
            }, serverError);
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

  }, [messages, firestore, chatId, authUser, isBlocked]);
  
  const prevOtherUserIsOnline = useRef(otherUser?.isOnline);
  // Update sent messages to delivered when the other user comes online
  useEffect(() => {
    if (!firestore || !chatId || !authUser || !otherUser || isBlocked) return;

    // Check if the user just came online from an offline state
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
                path: `chats/${chatId}/messages`,
                operation: 'update',
                requestResourceData: { status: 'delivered' }
            }, serverError);
            errorEmitter.emit('permission-error', permissionError);
          });
        }
      });
    }

    // Update the ref for the next render
    prevOtherUserIsOnline.current = otherUser.isOnline;
  }, [otherUser, firestore, chatId, authUser, isBlocked]);
  
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
  
  // --- Voice Recording Logic ---

  const formatRecordingTime = (durationInSeconds: number) => {
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const sendAudioMessage = useCallback(async (audioBlob: Blob) => {
        if (!firestore || !chatId || !authUser || !otherUser || audioBlob.size === 0) return;
    
        const localMessageId = `local_${Date.now()}`;
        const isOtherUserOnline = otherUser?.isOnline ?? false;
        
        // 1. Optimistic UI Update: Add a temporary message with a local blob URL
        const optimisticMessage: MessageType = {
            id: localMessageId,
            senderId: authUser.uid,
            content: 'Voice message',
            timestamp: Timestamp.now(),
            type: 'audio',
            mediaUrl: URL.createObjectURL(audioBlob),
            status: 'sent', // Will be updated later
            isUploading: true, // Mark as uploading
        };
        setMessages(prev => [...prev, optimisticMessage]);

        const storage = getStorage();
        const audioFileRef = storageRef(storage, `chats/${chatId}/${Date.now()}.webm`);

        try {
            // 2. Upload the file
            const snapshot = await uploadBytes(audioFileRef, audioBlob);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // 3. Ensure chat document exists before adding message
            const chatRef = doc(firestore, 'chats', chatId);
            const chatSnap = await getDoc(chatRef);
             if (!chatSnap.exists()) {
                const chatData = {
                    members: [authUser.uid, otherUser.uid],
                    createdAt: serverTimestamp(),
                    participantDetails: {
                        [authUser.uid]: { displayName: currentUser?.displayName, photoURL: currentUser?.photoURL },
                        [otherUser.uid]: { displayName: otherUser.displayName, photoURL: otherUser.photoURL }
                    },
                    unreadCount: { [authUser.uid]: 0, [otherUser.uid]: 0, },
                    typing: { [authUser.uid]: false, [otherUser.uid]: false, }
                };
                await setDoc(chatRef, chatData);
            }

            // 4. Add the real message to Firestore with the correct structure
            const messagesRef = collection(firestore, 'chats', chatId, 'messages');
            const newAudioMessageData = {
                senderId: authUser.uid,
                content: 'Voice message',
                timestamp: serverTimestamp(),
                type: 'audio' as const,
                mediaUrl: downloadURL,
                status: isOtherUserOnline ? 'delivered' : 'sent',
            };
            
            const docRef = await addDoc(messagesRef, newAudioMessageData);
            playSendMessageSound();
            
            // 5. Update the local message from uploading to sent
             setMessages(prev => prev.map(msg => 
                msg.id === localMessageId 
                ? { ...msg, id: docRef.id, isUploading: false, mediaUrl: downloadURL, status: newAudioMessageData.status as MessageType['status'] } 
                : msg
            ));
            
            // 6. Update last message and unread count
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
            // Mark the optimistic message as failed
            setMessages(prev => prev.map(msg => 
                msg.id === localMessageId 
                ? { ...msg, uploadFailed: true, isUploading: false } 
                : msg
            ));
            toast({ title: 'Error', description: 'Could not send voice message.', variant: 'destructive' });
        }
    }, [firestore, chatId, authUser, otherUser, toast, currentUser, playSendMessageSound]);

    const stopRecording = useCallback((send: boolean) => {
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            setIsRecording(false);
            return;
        }
        
        mediaRecorderRef.current.onstop = async () => {
            const tracks = mediaRecorderRef.current?.stream.getTracks() ?? [];
            tracks.forEach(track => track.stop());

            if (send) {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 100) { // Dont send empty recordings
                    await sendAudioMessage(audioBlob);
                }
            }
            
            audioChunksRef.current = [];
            setIsRecording(false);
            setRecordingDuration(0);
            mediaRecorderRef.current = null;
        };
        
        // This check is crucial. Only call stop() if the recorder is actually recording.
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        } else { // If not recording, just clean up state.
             audioChunksRef.current = [];
            setIsRecording(false);
            setRecordingDuration(0);
        }

    }, [sendAudioMessage]);
    
    const startRecording = useCallback(async () => {
        if (isRecording) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            recorder.onstart = () => {
                setIsRecording(true);
                setRecordingDuration(0); 
                recordingIntervalRef.current = setInterval(() => {
                    setRecordingDuration(prev => prev + 1);
                }, 1000);
            };

            recorder.start();
        } catch (error) {
            console.error("Error starting recording:", error);
            toast({ title: "Microphone Access Denied", description: "Please grant microphone access to record audio.", variant: "destructive"});
        }
    }, [isRecording, toast]);

    // Button-specific handlers
    const handleMicButtonClick = () => {
        // This button should only START recording.
        if (!isRecording) {
            startRecording();
        }
    };

    const handleCancelRecording = () => {
        // This stops recording and DISCARDS the audio.
        stopRecording(false);
    };
    
    const handleSendRecording = () => {
        // This stops recording and SENDS the audio.
        stopRecording(true);
    };
    // --- End Voice Recording Logic ---

    const handleSendMessage = () => {
      if (inputValue.trim() === '' || !firestore || !authUser || !chatId || !otherUser || !currentUser) return;

      const contentToSend = inputValue.trim();
      setInputValue(''); // Clear input immediately for better UX
      
      setTimeout(() => playSendMessageSound(), 50);

      // Keep keyboard open by re-focusing
      inputRef.current?.focus();

      const isOtherUserOnline = otherUser?.isOnline ?? false;

      const newMessageData: any = {
        senderId: authUser.uid,
        content: contentToSend,
        timestamp: serverTimestamp(),
        type: 'text' as const,
        status: isOtherUserOnline ? 'delivered' : 'sent'
      };

      if (replyToMessage) {
        newMessageData.replyTo = {
          messageId: replyToMessage.id,
          content: replyToMessage.content,
          senderId: replyToMessage.senderId,
        };
        setReplyToMessage(null); // Reset reply state
      }

      const chatRef = doc(firestore, 'chats', chatId);
      const messagesRef = collection(firestore, 'chats', chatId, 'messages');
      const typingUpdate: { [key: string]: any } = {};
      typingUpdate[`typing.${authUser.uid}`] = false;
      const userRef = doc(firestore, 'users', authUser.uid);


      // Ensure chat doc exists, then add message and update last message
      // This is all done in the background, not blocking the UI thread
      getDoc(chatRef).then(async (chatSnap) => {
        const batch = writeBatch(firestore);

        if (!chatSnap.exists()) {
          const newChatData = {
              members: [authUser.uid, otherUser.uid],
              createdAt: serverTimestamp(),
              participantDetails: {
                  [authUser.uid]: { displayName: currentUser.displayName, photoURL: currentUser.photoURL },
                  [otherUser.uid]: { displayName: otherUser.displayName, photoURL: otherUser.photoURL }
              },
              unreadCount: { [authUser.uid]: 0, [otherUser.uid]: 0 },
              typing: { [authUser.uid]: false, [otherUser.uid]: false }
          };
          batch.set(chatRef, newChatData);
        }

        const newMessageRef = doc(messagesRef); // Create a new doc ref for the message
        batch.set(newMessageRef, newMessageData);

        const lastMessageData = {
          content: newMessageData.content,
          timestamp: serverTimestamp(),
          senderId: newMessageData.senderId
        };

        const unreadCountKey = `unreadCount.${otherUser.uid}`;
        batch.update(chatRef, {
            lastMessage: lastMessageData,
            [unreadCountKey]: increment(1),
            ...typingUpdate
        });
        
        // Smart score update logic
        const now = new Date();
        const dailyReset = currentUser.lastDailyReset ? currentUser.lastDailyReset.toDate() : new Date(0);
        const weeklyReset = currentUser.lastWeeklyReset ? currentUser.lastWeeklyReset.toDate() : new Date(0);
        const monthlyReset = currentUser.lastMonthlyReset ? currentUser.lastMonthlyReset.toDate() : new Date(0);
        
        const scoreUpdates: { [key: string]: any } = {};

        if (differenceInCalendarMonths(now, monthlyReset) >= 1) {
            scoreUpdates.monthlyActivityScore = 1;
            scoreUpdates.weeklyActivityScore = 1;
            scoreUpdates.dailyActivityScore = 1;
            scoreUpdates.lastMonthlyReset = serverTimestamp();
            scoreUpdates.lastWeeklyReset = serverTimestamp();
            scoreUpdates.lastDailyReset = serverTimestamp();
        } else if (differenceInCalendarWeeks(now, weeklyReset, { weekStartsOn: 1 }) >= 1) {
            scoreUpdates.weeklyActivityScore = 1;
            scoreUpdates.dailyActivityScore = 1;
            scoreUpdates.lastWeeklyReset = serverTimestamp();
            scoreUpdates.lastDailyReset = serverTimestamp();
            scoreUpdates.monthlyActivityScore = increment(1);
        } else if (differenceInHours(now, dailyReset) >= 24) {
            scoreUpdates.dailyActivityScore = 1;
            scoreUpdates.lastDailyReset = serverTimestamp();
            scoreUpdates.weeklyActivityScore = increment(1);
            scoreUpdates.monthlyActivityScore = increment(1);
        } else {
            scoreUpdates.dailyActivityScore = increment(1);
            scoreUpdates.weeklyActivityScore = increment(1);
            scoreUpdates.monthlyActivityScore = increment(1);
        }

        batch.update(userRef, scoreUpdates);

        return batch.commit();
      })
      .catch((serverError: any) => {
          toast({
            title: "Error Sending Message",
            description: "Could not send your message. Please try again.",
            variant: "destructive",
          });
          const permissionError = new FirestorePermissionError({
              path: messagesRef.path,
              operation: 'create',
              requestResourceData: newMessageData,
          }, serverError);
          errorEmitter.emit('permission-error', permissionError);
      });
    };
    
    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (!firestore || !authUser || !chatId) return;

        const chatRef = doc(firestore, 'chats', chatId);
        
        // Indicate user is typing
        const startTypingUpdate: { [key: string]: any } = {};
        startTypingUpdate[`typing.${authUser.uid}`] = true;
        updateDoc(chatRef, startTypingUpdate);

        // Debounce to stop typing indicator
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            const stopTypingUpdate: { [key:string]: any } = {};
            stopTypingUpdate[`typing.${authUser.uid}`] = false;
            updateDoc(chatRef, stopTypingUpdate);
        }, 2000); // 2 seconds timeout
    };


    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            handleSendMessage();
        }
    };
  
    const handleReplyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        isDraggingReply.current = false; // Reset on new touch
        const touch = e.targetTouches[0];
        if (touch) {
            touchStartX.current = touch.clientX;
            touchMoveX.current = touch.clientX;
        }
    };

    const handleReplyTouchMove = (e: React.TouchEvent<HTMLDivElement>, target: HTMLDivElement) => {
        if (!target) return;
        const currentX = e.targetTouches[0].clientX;
        const diffX = currentX - touchStartX.current;
        touchMoveX.current = currentX;

        // Only start dragging if moving horizontally
        if (Math.abs(diffX) > 10) {
            isDraggingReply.current = true;
        }
        
        // Only allow swiping right-to-left, and not too far
        if (diffX < 0 && diffX > -100) {
            target.style.transform = `translateX(${diffX}px)`;
        }
    };

    const handleReplyTouchEnd = (msg: MessageType, target: HTMLDivElement) => {
        if (!target) return;

        const diffX = touchMoveX.current - touchStartX.current;
        
        // Only trigger reply if it was a significant right-to-left drag
        if (isDraggingReply.current && diffX < -50) { 
            setReplyToMessage(msg);
            inputRef.current?.focus();
        }

        // Reset style and flags regardless
        target.style.transform = 'translateX(0)';
        touchStartX.current = 0;
        touchMoveX.current = 0;
        isDraggingReply.current = false;
    };
    
    const handleInitiateCall = (type: 'audio' | 'video') => {
        if (!otherUser || !callContext) return;
        callContext.startCall(otherUser.uid, type);
    };

    // --- Menu Actions ---
    const handleBlockUser = async () => {
        if (!firestore || !authUser || !otherUser) return;
        const currentUserRef = doc(firestore, 'users', authUser.uid);
        try {
            await updateDoc(currentUserRef, { blockedUsers: arrayUnion(otherUser.uid) });
            toast({ title: 'User Blocked', description: `${otherUser.displayName} has been blocked.` });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not block user.', variant: 'destructive' });
        }
    };

    const handleUnfriend = async () => {
        if (!firestore || !authUser || !otherUser || !chatId) return;
        const currentUserRef = doc(firestore, 'users', authUser.uid);
        const otherUserRef = doc(firestore, 'users', otherUser.uid);
        const chatRef = doc(firestore, 'chats', chatId);

        const batch = writeBatch(firestore);
        batch.update(currentUserRef, { friends: arrayRemove(otherUser.uid), chatIds: arrayRemove(chatId) });
        batch.update(otherUserRef, { friends: arrayRemove(authUser.uid), chatIds: arrayRemove(chatId) });
        
        try {
             // To delete a chat, first delete all its messages
            const messagesRef = collection(firestore, 'chats', chatId, 'messages');
            const messagesSnapshot = await getDocs(messagesRef);
            messagesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            // Then delete the chat document itself
            batch.delete(chatRef);
        
            await batch.commit();
            toast({ title: 'Unfriended', description: `You are no longer friends with ${otherUser.displayName}. The chat has been deleted.` });
            router.push('/chat');
        } catch (error) {
            toast({ title: 'Error', description: 'Could not unfriend user.', variant: 'destructive' });
            console.error("Unfriend error: ", error);
        }
    };
    
    const handleClearChat = async () => {
        if (!firestore || !authUser || !chatId) return;
        const currentUserRef = doc(firestore, 'users', authUser.uid);
        const fieldPath = `chatsCleared.${chatId}`;
        const payload = { [fieldPath]: serverTimestamp() };
        try {
            await updateDoc(currentUserRef, payload);
            toast({ title: "Chat Cleared", description: "Your view of this chat has been cleared."});
        } catch(error) {
            toast({ title: "Error", description: "Could not clear chat.", variant: "destructive" });
        } finally {
            setClearChatDialogOpen(false);
        }
    };

    const handleDeleteMessageForEveryone = async (messageId: string) => {
        if (!firestore || !chatId) return;
        const msgRef = doc(firestore, 'chats', chatId, 'messages', messageId);
        try {
            await deleteDoc(msgRef);
            toast({ title: 'Message Deleted' });
        } catch (error) {
            console.error('Error deleting message for everyone:', error);
            toast({ title: 'Error', description: 'Could not delete message.', variant: 'destructive' });
        }
    };

    const handleDeleteMessageForMe = async (messageId: string) => {
        if (!firestore || !authUser) return;
        const userRef = doc(firestore, 'users', authUser.uid);
        try {
            await updateDoc(userRef, {
                deletedMessages: arrayUnion(messageId)
            });
            toast({ title: 'Message Removed', description: 'The message has been removed for you.' });
        } catch (error) {
            console.error('Error deleting message for me:', error);
            toast({ title: 'Error', description: 'Could not remove message.', variant: 'destructive' });
        }
    };
    
    const handleConfirmDelete = (mode: 'forMe' | 'forEveryone') => {
        if (!messageToDelete) return;

        if (mode === 'forEveryone') {
            handleDeleteMessageForEveryone(messageToDelete.id);
        } else {
            handleDeleteMessageForMe(messageToDelete.id);
        }
        setDeleteMsgDialogOpen(false);
        setMessageToDelete(null);
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
      try {
        return format(date, 'p'); // e.g., 12:00 PM
      } catch (e) {
        return ''; // Return empty string if date is invalid
      }
  };

  const formatLastSeen = (timestamp: any) => {
      if (!timestamp) return 'Offline';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      try {
        return `Last seen ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
      } catch (e) {
        return 'Offline';
      }
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
                 if (msg.uploadFailed) {
                    return <div className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /><span>Failed to send</span></div>
                }
                return (
                    <audio controls src={msg.mediaUrl} className="max-w-full">
                        Your browser does not support the audio element.
                    </audio>
                );
            case 'image':
                 return msg.mediaUrl ? <img src={msg.mediaUrl} alt="sent image" className="rounded-lg max-w-full" /> : <p>Image not available</p>;
             case 'room_invite':
                if (!msg.roomInvite) return <p>Invalid room invite</p>;
                return (
                    <div className="space-y-2">
                        <p className="font-semibold">Room Invitation</p>
                        <div className="flex items-center gap-2 p-2 rounded-md bg-black/10 dark:bg-white/10">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={msg.roomInvite.roomPhotoURL} />
                                <AvatarFallback>{msg.roomInvite.roomName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate font-medium text-sm">{msg.roomInvite.roomName}</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => router.push(`/chat/rooms/${msg.roomInvite?.roomId}`)}
                        >
                            <DoorOpen className="mr-2 h-4 w-4"/> Join Room
                        </Button>
                    </div>
                );
            case 'call':
                 const isMissed = msg.callInfo?.status === 'missed' || msg.callInfo?.status === 'declined';
                 const isOutgoing = msg.senderId === authUser.uid;
                 const icon = msg.callInfo?.type === 'video' ? <Video className="h-4 w-4 mr-2"/> : <Phone className="h-4 w-4 mr-2"/>;
                 return (
                    <div className="flex items-center">
                        {icon}
                        <div>
                            <p className="font-semibold">{isMissed ? 'Missed Call' : 'Call'}</p>
                            <p className="text-xs">{isOutgoing ? 'Outgoing' : 'Incoming'} - {msg.callInfo?.duration}</p>
                        </div>
                    </div>
                )
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
      <ClearChatDialog
        isOpen={isClearChatDialogOpen}
        onOpenChange={setClearChatDialogOpen}
        onConfirm={handleClearChat}
        userName={otherUser.displayName}
      />
      <DeleteMessageDialog
        isOpen={isDeleteMsgDialogOpen}
        onOpenChange={setDeleteMsgDialogOpen}
        onConfirm={handleConfirmDelete}
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
                  <div className="relative">
                      <Avatar>
                          <AvatarImage src={otherUser.photoURL} />
                          <AvatarFallback>{getInitials(otherUser.displayName)}</AvatarFallback>
                      </Avatar>
                      {otherUser?.officialBadge?.isOfficial && (
                          <div className="absolute bottom-0 right-0">
                            <OfficialBadge color={otherUser.officialBadge.badgeColor} size="icon" className="h-4 w-4" isOwner={otherUser.canManageOfficials} />
                          </div>
                        )}
                  </div>
                  <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={"font-semibold"}>
                      {applyNameColor(otherUser.displayName.split(' ')[0], otherUser.nameColor)}
                    </p>
                    {otherUser.verifiedBadge?.showBadge && (
                         <VerifiedBadge color={otherUser.verifiedBadge.badgeColor} />
                    )}
                  </div>
                    <p className={cn("text-xs", isTyping || otherUser.isOnline ? "text-green-500" : "text-muted-foreground")}>
                      {isTyping ? "typing..." : otherUser.isOnline ? 'Online' : formatLastSeen(otherUser.lastSeen)}
                  </p>
                  </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleInitiateCall('audio')}>
                  <Phone className="h-5 w-5" />
                  <span className="sr-only">Audio Call</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleInitiateCall('video')}>
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
                   <DropdownMenuItem onClick={() => setContactSheetOpen(true)}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>View Contact</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBlockUser} className="text-destructive focus:text-destructive">
                        <ShieldX className="mr-2 h-4 w-4" />
                        <span>Block User</span>
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={handleUnfriend} className="text-destructive focus:text-destructive">
                        <UserX className="mr-2 h-4 w-4" />
                        <span>Unfriend</span>
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => setClearChatDialogOpen(true)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Clear Chat</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
          </header>

        {/* Messages Area */}
        <main className={cn("flex-1 overflow-y-auto")} ref={viewportRef}>
             {amIBlocked ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <Ban className="h-16 w-16 mb-4" />
                    <h2 className="text-xl font-semibold">You've been blocked</h2>
                    <p className="mt-2">You can no longer send messages to this user.</p>
                </div>
            ) : (
                <div className="space-y-2 p-6">
                {messages.map((msg) => {
                    const messageRef = React.createRef<HTMLDivElement>();
                    const isMyMessage = msg.senderId === authUser?.uid;
                    return (
                        <div
                        key={msg.id}
                        className={`group/message flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                        >
                        <div
                            className="relative transition-transform duration-200 ease-out"
                            ref={messageRef}
                            onTouchStart={(e) => !isMyMessage && handleReplyTouchStart(e)}
                            onTouchMove={(e) => !isMyMessage && messageRef.current && handleReplyTouchMove(e, messageRef.current)}
                            onTouchEnd={() => !isMyMessage && messageRef.current && handleReplyTouchEnd(msg, messageRef.current)}
                        >
                            <div
                            className={`flex max-w-xs flex-col rounded-lg px-3 py-2 text-sm lg:max-w-md ${
                                isMyMessage
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                            >
                            {isMyMessage && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="absolute top-1/2 -translate-y-1/2 -left-10 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => { setMessageToDelete(msg); setDeleteMsgDialogOpen(true); }}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
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
                                <div className={`flex items-center gap-1 text-[10px] shrink-0 self-end ${ isMyMessage ? 'text-primary-foreground/70' : 'text-muted-foreground' }`}>
                                    <span>{formatTimestamp(msg.timestamp)}</span>
                                    {isMyMessage && !msg.isUploading && (
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
            )}
          </main>

        {/* Message Input */}
         <footer className="shrink-0 border-t bg-muted/40 p-4">
            {isBlocked ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground bg-background p-3 rounded-lg">
                    <Ban className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        {haveIBlocked ? "You have blocked this user. Unblock them to send a message." : "You cannot reply to this conversation."}
                    </p>
                </div>
            ) : isRecording ? (
                 <div className="flex items-center gap-2 w-full h-[48px]">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 text-destructive"
                        onClick={handleCancelRecording}
                    >
                        <Trash2 className="h-6 w-6" />
                    </Button>
                    <div className="flex-1 flex items-center justify-center bg-destructive/10 rounded-full px-4">
                        <span className="relative flex h-3 w-3 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                        </span>
                        <span className="font-mono text-destructive font-semibold">
                            {formatRecordingTime(recordingDuration)}
                        </span>
                    </div>
                    <Button
                        size="icon"
                        className="rounded-full h-12 w-12"
                        onClick={handleSendRecording}
                    >
                        <Send className="h-6 w-6" />
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
                            {replyToMessage.senderId === authUser.uid ? 'yourself' : otherUser.displayName.split(' ')[0]}
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
                         {inputValue.trim() === '' ? (
                             <div className="relative w-full">
                                <Textarea
                                    ref={inputRef}
                                    placeholder="Type a message..."
                                    className="min-h-[48px] max-h-[120px] resize-none rounded-2xl border-2 border-input bg-transparent py-3 px-12 shadow-sm focus:border-primary focus:ring-primary"
                                    value={inputValue}
                                    onChange={handleTyping}
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
                         ) : (
                             <Textarea
                                ref={inputRef}
                                placeholder="Type a message..."
                                className="min-h-[48px] max-h-[120px] resize-none rounded-2xl border-2 border-input bg-transparent py-3 px-4 shadow-sm focus:border-primary focus:ring-primary"
                                value={inputValue}
                                onChange={handleTyping}
                                onKeyDown={handleKeyPress}
                                rows={1}
                                onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                                }}
                            />
                         )}


                        <div className="relative">
                            {inputValue.trim() ? (
                                <Button
                                    size="icon"
                                    className="rounded-full h-12 w-12 shrink-0"
                                    onClick={handleSendMessage}
                                >
                                    <Send className="h-6 w-6" />
                                    <span className="sr-only">Send</span>
                                </Button>
                            ) : (
                                <Button
                                    size="icon"
                                    className="rounded-full h-12 w-12 shrink-0"
                                    onClick={handleMicButtonClick}
                                >
                                    <Mic className="h-6 w-6" />
                                    <span className="sr-only">Record voice message</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </footer>
      </div>
    </>
  );
}
