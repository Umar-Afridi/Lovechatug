'use client';

import React from 'react';

// This layout wraps each tab panel in the swipeable carousel
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex-[0_0_100%]">
        {children}
    </div>
  );
}
