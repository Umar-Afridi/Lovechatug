'use client';

import { useState } from 'react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Paperclip, Send } from 'lucide-react';

export function ChatInput() {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (message.trim()) {
            console.log('Sending message:', message);
            setMessage('');
        }
    };
    
    return (
        <div className="relative">
            <Textarea
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                className="pr-24 min-h-[48px] resize-none"
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 flex gap-1">
                <Button size="icon" variant="ghost">
                    <Paperclip className="h-5 w-5" />
                    <span className="sr-only">Attach file</span>
                </Button>
                <Button size="icon" variant="ghost" onClick={handleSend}>
                    <Send className="h-5 w-5" />
                    <span className="sr-only">Send</span>
                </Button>
            </div>
        </div>
    );
}
