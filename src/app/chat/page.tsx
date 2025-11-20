'use client';

import { useRouter } from 'next/navigation';

// This is a workaround for the parallel routes issue with the app router.
// The content is now handled by the @inbox slot in the layout.
// This page component can be removed if the layout handles the default route.
export default function ChatRedirectPage() {
  const router = useRouter();
  if (typeof window !== 'undefined') {
    router.replace('/chat/inbox');
  }
  return null;
}
