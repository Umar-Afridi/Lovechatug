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
  nameColor?: 'default' | 'gradient' | 'green' | 'yellow' | 'pink' | 'purple' | 'red';
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
  type: 'text' | 'image' | 'audio' | 'room_invite' | 'notification' | 'call';
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
  callInfo?: {
      type: 'audio' | 'video';
      duration: string; // e.g., "15m 32s"
      status: 'answered' | 'missed' | 'declined' | 'outgoing';
  }
};

export type Chat = {
  id: string;
  members: string[]; // array of user ids
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
  status: 'answered' | 'missed' | 'declined' | 'outgoing' | 'ended';
  direction: 'incoming' | 'outgoing';
  timestamp: any; // Firestore ServerTimestamp for when the call was initiated
  answeredAt?: any; // Firestore ServerTimestamp for when the call was answered
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
    isLocked?: boolean;
    theme?: 'blue' | 'green' | 'red' | 'purple' | 'pink' | 'yellow';
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

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'verification_approved' | 'verification_rejected' | 'colorful_name_granted' | 'verified_badge_removed' | 'colorful_name_removed' | 'warning';
  isRead: boolean;
  createdAt: any; // Firestore ServerTimestamp
  senderId?: string;
  senderName?: string;
  senderPhotoURL?: string;
  senderOfficialBadge?: UserProfile['officialBadge'];
  senderNameColor?: UserProfile['nameColor'];
};
