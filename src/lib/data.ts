import type { Chat, User, Message } from './types';
import { PlaceHolderImages } from './placeholder-images';

const users: User[] = [
  { id: 'user1', name: 'You', avatar: PlaceHolderImages.find(img => img.id === 'avatar1')?.imageUrl!, online: true },
  { id: 'user2', name: 'Alice', avatar: PlaceHolderImages.find(img => img.id === 'avatar2')?.imageUrl!, online: true },
  { id: 'user3', name: 'Bob', avatar: PlaceHolderImages.find(img => img.id === 'avatar3')?.imageUrl!, online: false },
  { id: 'user4', name: 'Charlie', avatar: PlaceHolderImages.find(img => img.id === 'avatar4')?.imageUrl!, online: true },
  { id: 'user5', name: 'Diana', avatar: PlaceHolderImages.find(img => img.id === 'avatar5')?.imageUrl!, online: false },
  { id: 'user6', name: 'Eve', avatar: PlaceHolderImages.find(img => img.id === 'avatar6')?.imageUrl!, online: true },
];

const messages: { [key: string]: Message[] } = {
  chat1: [
    { id: 'msg1', senderId: 'user2', content: 'Hey! How have you been?', timestamp: '10:30 AM', type: 'text' },
    { id: 'msg2', senderId: 'user1', content: 'Hey Alice! I\'m doing great, thanks for asking. How about you?', timestamp: '10:31 AM', type: 'text' },
    { id: 'msg3', senderId: 'user2', content: 'I\'m good too! Just working on a new project. It\'s pretty exciting.', timestamp: '10:32 AM', type: 'text' },
    { id: 'msg4', senderId: 'user2', content: 'Here\'s a picture from my vacation last week.', timestamp: '10:33 AM', type: 'image', image: PlaceHolderImages.find(img => img.id === 'chatImage1') },
  ],
  chat2: [
    { id: 'msg5', senderId: 'user3', content: 'Hi, do you have the files for the Roshan project?', timestamp: 'Yesterday', type: 'text' },
    { id: 'msg6', senderId: 'user1', content: 'Yes Bob, I\'ll send them over in a minute.', timestamp: 'Yesterday', type: 'text' },
  ],
  chat3: [
    { id: 'msg7', senderId: 'user4', content: 'Let\'s catch up later this week.', timestamp: 'Monday', type: 'text' },
  ],
  chat4: [
    { id: 'msg8', senderId: 'user5', content: 'Happy Birthday! 🎉', timestamp: 'Sunday', type: 'text' },
  ],
  chat5: [
    { id: 'msg9', senderId: 'user6', content: 'Can you review my code?', timestamp: 'Friday', type: 'text' },
  ],
};

export const chats: Chat[] = [
  { id: 'chat1', participants: [users[0], users[1]], messages: messages.chat1, unreadCount: 2 },
  { id: 'chat2', participants: [users[0], users[2]], messages: messages.chat2, unreadCount: 0 },
  { id: 'chat3', participants: [users[0], users[3]], messages: messages.chat3, unreadCount: 1 },
  { id: 'chat4', participants: [users[0], users[4]], messages: messages.chat4, unreadCount: 0 },
  { id: 'chat5', participants: [users[0], users[5]], messages: messages.chat5, unreadCount: 0 },
];

export const getChats = () => chats;

export const getChatById = (id: string) => {
    return chats.find(chat => chat.id === id);
}

export const getChatPartner = (chat: Chat) => {
    return chat.participants.find(p => p.id !== 'user1');
}
