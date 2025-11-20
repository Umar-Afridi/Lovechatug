'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This is a workaround for the parallel routes issue with the app router.
// The content is now handled by the @inbox slot in the layout.
// This page component can be removed if the layout handles the default route.
export default function ChatRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/chat/inbox');
  }, [router]);
  return null;
}
