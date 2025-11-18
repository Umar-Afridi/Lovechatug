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
    id: 'placeholder-2',
    name: 'Golden Wreath',
    imageUrl: 'https://picsum.photos/seed/frame2/200/200',
    quantity: 3,
    durationDays: 3,
  },
  {
    id: 'placeholder-3',
    name: 'Neon Circle',
    imageUrl: 'https://picsum.photos/seed/frame3/200/200',
    quantity: 10,
    durationDays: 1,
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
