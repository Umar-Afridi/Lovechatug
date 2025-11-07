'use client';

import React, { useState } from 'react';
import {
  Phone,
  Video,
  MoreVertical,
  Trash2,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

// Mock data - replace with actual data from Firebase
const mockCalls = [
  {
    id: '1',
    name: 'Imran Khan',
    avatar: 'https://placehold.co/100x100/E2E8F0/4A5568?text=IK',
    type: 'video' as const,
    direction: 'incoming' as const,
    status: 'answered' as const,
    time: 'Yesterday, 10:30 PM',
  },
  {
    id: '2',
    name: 'Nawaz Sharif',
    avatar: 'https://placehold.co/100x100/E2E8F0/4A5568?text=NS',
    type: 'audio' as const,
    direction: 'outgoing' as const,
    status: 'answered' as const,
    time: 'Yesterday, 9:15 PM',
  },
  {
    id: '3',
    name: 'Asif Zardari',
    avatar: 'https://placehold.co/100x100/E2E8F0/4A5568?text=AZ',
    type: 'audio' as const,
    direction: 'incoming' as const,
    status: 'missed' as const,
    time: '2 days ago',
  },
];


export default function CallsPage() {
  const [calls, setCalls] = useState(mockCalls);
  const [isClearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleClearAll = () => {
    setCalls([]);
    setClearAllDialogOpen(false);
    toast({
      title: 'Call History Cleared',
      description: 'All your call records have been deleted.',
    });
  };
  
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('') : 'U';

  const CallStatusIcon = ({ direction, status } : {direction: string, status: string}) => {
    const className = status === 'missed' ? 'text-destructive' : 'text-muted-foreground';
    if (direction === 'incoming') {
        return <PhoneIncoming className={className + " h-4 w-4"}/>
    }
    return <PhoneOutgoing className={className + " h-4 w-4"}/>
  }

  return (
    <>
      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your call history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              Yes, clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-bold">Call History</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setClearAllDialogOpen(true)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Clear all call history</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {calls.length > 0 ? (
            <div className="p-4 space-y-4">
                {calls.map((call, index) => (
                    <React.Fragment key={call.id}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={call.avatar} />
                                    <AvatarFallback>{getInitials(call.name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className={`font-semibold ${call.status === 'missed' ? 'text-destructive' : ''}`}>
                                        {call.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <CallStatusIcon direction={call.direction} status={call.status} />
                                        {call.time}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon">
                                {call.type === 'video' ? <Video className="h-5 w-5 text-primary" /> : <Phone className="h-5 w-5 text-primary" />}
                            </Button>
                        </div>
                        {index < calls.length - 1 && <Separator />}
                    </React.Fragment>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <PhoneMissed className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold">No Call History</h2>
                <p className="text-muted-foreground mt-2">
                You haven't made or received any calls yet.
                </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
