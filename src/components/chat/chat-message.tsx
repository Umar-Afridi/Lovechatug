import type { Message, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import Image from 'next/image';

interface ChatMessageProps {
    message: Message;
    isSentByCurrentUser: boolean;
    chatPartner: User;
    showAvatar: boolean;
}

export function ChatMessage({ message, isSentByCurrentUser, chatPartner, showAvatar }: ChatMessageProps) {
    return (
        <div className={cn('flex items-end gap-3', isSentByCurrentUser && 'justify-end')}>
            {!isSentByCurrentUser && showAvatar && (
                <Avatar className="h-8 w-8">
                    <AvatarImage src={chatPartner.avatar} alt={chatPartner.name} />
                    <AvatarFallback>{chatPartner.name.charAt(0)}</AvatarFallback>
                </Avatar>
            )}

            <div
                className={cn(
                    'max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-3 text-sm shadow-md',
                    isSentByCurrentUser
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-card text-card-foreground rounded-bl-none'
                )}
            >
                {message.type === 'text' ? (
                     <p>{message.content}</p>
                ) : (
                    message.image && (
                         <Image
                            src={message.image.imageUrl}
                            alt={message.image.description}
                            width={300}
                            height={225}
                            className="rounded-md"
                            data-ai-hint={message.image.imageHint}
                        />
                    )
                )}
               
            </div>
             {isSentByCurrentUser && showAvatar && (
                <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?text=You" />
                    <AvatarFallback>Y</AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}
