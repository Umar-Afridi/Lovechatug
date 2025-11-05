'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  onSnapshot,
  doc,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

export function useDoc<T extends DocumentData>(
  collectionName: string,
  docId: string
) {
  const firestore = useFirestore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const docRef = useMemo(
    () => (firestore ? doc(firestore, collectionName, docId) : null),
    [firestore, collectionName, docId]
  );

  useEffect(() => {
    if (!docRef) return;
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error };
}
