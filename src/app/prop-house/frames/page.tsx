'use client';

import { FrameCard } from '@/components/prop-house/frame-card';

// This is demo data. In a real app, you would fetch this from Firestore.
const frameItems = [
  {
    id: 'lovechat-butterfly-frame',
    name: 'Love Chat Butterfly',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Flovechat_frame.png?alt=media&token=e9391338-3375-4752-953e-86d3b45155e8',
    quantity: 1,
    durationDays: 7,
  },
  {
    id: 'tiger-king-frame',
    name: 'Tiger King Frame',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Ftiger-king-frame.png?alt=media&token=a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    quantity: 1,
    durationDays: 7,
  },
];


export default function FramesPage() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {frameItems.map((item) => (
        <FrameCard key={item.id} item={item} />
      ))}
    </div>
  );
}
