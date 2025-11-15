'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useUser } from '@/firebase/auth/use-user';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { user } = useUser();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError | Error) => {
      let contextualError: Error;
      
      // Ensure the error is an instance of FirestorePermissionError and has the method
      if (error instanceof FirestorePermissionError && typeof error.formatMessage === 'function') {
        // Create an error with the full context, including the user.
        contextualError = new Error(error.formatMessage(user));
        contextualError.name = error.name;
        contextualError.stack = error.stack;
      } else {
        // Fallback for generic errors
        contextualError = error;
      }
      
      // Throw it so Next.js Development Overlay can catch it.
      // This will only work in development. In production, it will be a silent failure.
      // For production, you might want to log this to an error reporting service.
      if (process.env.NODE_ENV === 'development') {
        throw contextualError;
      } else {
        console.error(contextualError.message);
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [user]);

  return null;
}

    