export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  photoURL: string;
  friends?: string[];
}

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar: string;
  online: boolean;
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
};

export type Chat = {
  id: string;
  participants: string[]; // array of user ids
  messages: Message[];
  unreadCount: number;
  // This is a temporary field for mock data to hold the other user's details
  participantDetails?: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
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
    from: string; // user id
    to: string; // user id
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
