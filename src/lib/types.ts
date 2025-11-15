export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  photoURL: string;
  friends?: string[];
  bio?: string;
  isOnline?: boolean;
  lastSeen?: any;
  blockedUsers?: string[]; // Users this user has blocked
  blockedBy?: string[];   // Users who have blocked this user
  chatIds?: string[]; 
  chatsCleared?: {
    [chatId: string]: any; // Store server timestamp for when a chat was cleared
  }
  verifiedBadge?: {
    showBadge: boolean;
    badgeColor: 'blue' | 'gold' | 'green' | 'red' | 'pink';
  }
  officialBadge?: {
    isOfficial: boolean;
    badgeColor: 'blue' | 'gold' | 'green' | 'red' | 'pink';
  }
  colorfulName?: boolean;
  verificationApplicationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  lastVerificationRequestAt?: any; // Firestore ServerTimestamp
  lastColorfulNameRequestAt?: any; // Firestore ServerTimestamp
  isDisabled?: boolean; // New field for disabled status
}

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: any; // Firestore ServerTimestamp
  type: 'text' | 'image' | 'audio' | 'room_invite' | 'notification'; // Added 'notification' type
  mediaUrl?: string;
  status: 'sent' | 'delivered' | 'read';
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
  };
  isUploading?: boolean;
  uploadFailed?: boolean;
  roomInvite?: {
    roomId: string;
    roomName: string;
    roomPhotoURL?: string;
  }
};

export type Chat = {
  id: string;
  members: string[]; // array of user ids
  participants: string[]; // array of user ids, for security rules
  createdAt: any;
  lastMessage?: {
    content: string;
    timestamp: any; // Firestore ServerTimestamp
    senderId: string;
  } | null;
  participantDetails?: {
    [key: string]: {
        displayName: string;
        photoURL: string;
    }
  }
  // New field for unread counts
  unreadCount?: {
    [key: string]: number; // key is userId, value is count
  }
  typing?: {
    [key: string]: boolean;
  }
};

export type FriendRequest = {
    id: string;
    senderId: string; // user id
    receiverId: string; // user id
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: any; // Firestore ServerTimestamp
}

export type Call = {
  id: string;
  callerId: string;
  receiverId: string;
  participants: string[]; // [callerId, receiverId]
  type: 'audio' | 'video';
  status: 'answered' | 'missed' | 'declined' | 'outgoing';
  direction: 'incoming' | 'outgoing';
  timestamp: any; // Firestore ServerTimestamp
  duration?: number; // in seconds
};

export type Room = {
    id: string;
    name: string;
    ownerId: string;
    ownerIsOfficial?: boolean;
    photoURL?: string;
    createdAt: any;
    members: string[];
    memberCount: number;
    lockedSlots?: number[];
    kickedUsers?: {
      [userId: string]: any; // Store server timestamp for when a user was kicked
    }
};

export type RoomMember = {
    userId: string;
    micSlot: number | null; // 0 for owner, 1-8 for members, -1 for super admin
    isMuted: boolean;
};

export type RoomMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  content: string;
  timestamp: any; // Firestore ServerTimestamp
  type: 'text' | 'notification'; // Add type for notifications
};
