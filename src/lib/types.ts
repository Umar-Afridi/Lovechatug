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
  blockedUsers?: string[];
  chatIds: string[]; // New field to store user's chat IDs
}

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: any; // Firestore ServerTimestamp
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  status: 'sent' | 'delivered' | 'read';
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
};

export type Group = {
  id: string;
  name: string;
  members: string[]; // array of user ids
  admins: string[]; // array of user ids
  avatar: string;
}

export type FriendRequest = {
    id: string;
    senderId: string; // user id
    receiverId: string; // user id
    status: 'pending' | 'accepted' | 'rejected';
}

export type Call = {
    id: string;
    caller: string; // user id
    receiver: string; // user id
    type: 'audio' | 'video';
    status: 'missed' | 'answered' | 'declined';
    timestamp: string;
}
