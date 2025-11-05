import type { ImagePlaceholder } from './placeholder-images';

export type User = {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image';
  image?: ImagePlaceholder;
};

export type Chat = {
  id: string;
  participants: User[];
  messages: Message[];
  unreadCount: number;
};
