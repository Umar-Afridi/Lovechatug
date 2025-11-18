'use client';

import { FrameCard } from '@/components/prop-house/frame-card';

// In a real application, this data would come from a database (e.g., Firestore)
const availableFrames = [
  {
    id: 'love-chat-butterfly',
    name: 'Love Chat Butterfly',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Flovechat_frame.png?alt=media&token=e9391338-3375-4752-953e-86d3b45155e8',
    quantity: 1,
    durationDays: 30,
  },
];

export default function FramesPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
       <p className="text-muted-foreground mb-6 text-center">Props in the prop warehouse can be gifted to friends or used by yourself</p>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {availableFrames.map((frame) => (
          <FrameCard key={frame.id} item={frame} />
        ))}
      </div>
    </div>
  );
}
