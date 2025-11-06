'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  Video,
  MoreVertical,
  Mic,
  Send,
  Smile,
  Paperclip,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import type { Chat, Message } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ChatDetailProps {
  chat: Chat;
}

export function ChatDetail({ chat }: ChatDetailProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Omit<Message, 'id' | 'timestamp' | 'senderId' | 'type'> & { id: string; sender: string; text: string; }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mock messages for display, combining initial and chat messages
    const initialMessages = [
      { id: '1', sender: 'other', text: 'Hey, how are you?' },
      { id: '2', sender: 'me', text: 'I am good, thanks! How about you?' },
      { id: '3', sender: 'other', text: 'Doing great! Just working on the new project.' },
      { id: '4', sender: 'me', text: 'Awesome! Let me know if you need any help.' },
      ...chat.messages.map(m => ({ id: m.id, sender: m.senderId === 'user1' ? 'me' : 'other', text: m.content})),
    ];
    setMessages(initialMessages);
  }, [chat.messages]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if(viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

  const handleBlockUser = () => {
    toast({
        title: "User Blocked",
        description: `${chat.participantDetails?.name} has been blocked.`,
    })
  }

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;

    const newMessage = {
      id: (messages.length + 1).toString(),
      sender: 'me',
      text: inputValue.trim(),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };


  return (
    <div className="flex h-screen flex-col">
      {/* Chat Header */}
      <header className="flex items-center gap-4 border-b bg-muted/40 px-6 py-3">
        <Avatar>
          <AvatarImage src={chat.participantDetails?.avatar} />
          <AvatarFallback>{getInitials(chat.participantDetails?.name ?? 'U')}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold">{chat.participantDetails?.name}</p>
          {/* Online status removed for simplicity with real-time backend */}
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
              <DropdownMenuItem>View Contact</DropdownMenuItem>
              <DropdownMenuItem>Media, links, and docs</DropdownMenuItem>
              <DropdownMenuItem>Search</DropdownMenuItem>
              <Separator />
              <DropdownMenuItem>Change Background</DropdownMenuItem>
              <DropdownMenuItem>Change Theme</DropdownMenuItem>
              <Separator />
              <DropdownMenuItem onClick={handleBlockUser} className="text-destructive">
                Block User
              </DropdownMenuItem>
               <DropdownMenuItem>Clear Chat</DropdownMenuItem>
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
                    className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-xs rounded-lg px-4 py-2 text-sm lg:max-w-md ${
                            msg.sender === 'me'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                    >
                        {msg.text}
                    </div>
                </div>
            ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <footer className="border-t bg-muted/40 p-4">
        <div className="relative flex items-center">
          <Button variant="ghost" size="icon" className="absolute left-1">
            <Smile className="h-5 w-5" />
            <span className="sr-only">Emoji</span>
          </Button>
          <Input 
            placeholder="Type a message..." 
            className="pl-12 pr-24"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <div className="absolute right-1 flex items-center">
            <Button variant="ghost" size="icon">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
             <Button variant="ghost" size="icon">
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
  );
}
