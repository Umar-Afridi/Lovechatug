'use client';

import { useEffect, useState } from 'react';
import { generateSuggestedReplies } from '@/ai/flows/ai-suggested-replies';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Sparkles } from 'lucide-react';

interface AiReplySuggestionsProps {
    messageContent: string;
}

export function AiReplySuggestions({ messageContent }: AiReplySuggestionsProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const getSuggestions = async () => {
            setLoading(true);
            try {
                const result = await generateSuggestedReplies({ messageContent });
                setSuggestions(result.suggestions);
            } catch (error) {
                console.error('Failed to get AI suggestions:', error);
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        };

        if(messageContent) {
           getSuggestions();
        }
    }, [messageContent]);
    
    if (loading) {
        return (
            <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span>AI is thinking...</span>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-28" />
                </div>
            </div>
        )
    }

    if(suggestions.length === 0) {
        return null;
    }

    return (
        <div className="mb-4 space-y-2 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Suggested replies</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                    <Button key={index} variant="outline" size="sm" className="bg-background hover:bg-muted">
                        {suggestion}
                    </Button>
                ))}
            </div>
        </div>
    );
}
