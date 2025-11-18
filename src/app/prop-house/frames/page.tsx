'use client';

import { FrameCard } from '@/components/prop-house/frame-card';

// In a real application, this data would come from a database (e.g., Firestore)
const availableFrames = [
  {
    id: 'love-chat-butterfly-frame',
    name: 'Love Chat Butterfly',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Flovechat_frame.png?alt=media&token=e9391338-3375-4752-953e-86d3b45155e8',
    quantity: 22,
    durationDays: 7,
  },
  {
    id: 'golden-rays-entry',
    name: 'Golden Rays',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Fgolden_rays.png?alt=media&token=26227b16-4a43-41c6-94e8-a15d023a1a97',
    quantity: 2,
    durationDays: 7,
  },
   {
    id: 'green-energy-entry',
    name: 'Green Energy',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Fgreen_energy.png?alt=media&token=e65ad573-033a-48d6-9524-7f15e8b615b1',
    quantity: 2,
    durationDays: 7,
  },
  {
    id: 'mythical-dragon-entry',
    name: 'Mythical Dragon',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Fdragon.png?alt=media&token=4802c65a-0402-4091-a1e6-2e866b1a384b',
    quantity: 1,
    durationDays: 10,
  },
   {
    id: 'luxury-car-entry',
    name: 'Luxury Celebration',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Fgold_car.png?alt=media&token=38c37a6b-e3a2-4a02-b258-372132e08e68',
    quantity: 3,
    durationDays: 30,
  },
  {
    id: 'sports-car-entry',
    name: 'Red Speedster',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/lovechat-c483c.appspot.com/o/frames%2Fred_car.png?alt=media&token=9635e985-78e8-4682-995a-c605c317f093',
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
