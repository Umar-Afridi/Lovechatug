'use client';

import { FrameCard } from '@/components/prop-house/frame-card';

// In a real application, this data would come from a database (e.g., Firestore)
const availableFrames = [
  {
    id: 'love-chat-butterfly-frame',
    name: 'Love Chat Butterfly',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Flovechat_frame.png?alt=media&token=e9391338-3375-4752-953e-86d3b45155e8',
    price: 500, // Example price
    currency: 'gems',
  },
  // Add more frames here as they become available
];

export default function FramesPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {availableFrames.map((frame) => (
          <FrameCard key={frame.id} frame={frame} />
        ))}
      </div>
    </div>
  );
}
