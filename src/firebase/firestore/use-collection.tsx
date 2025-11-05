'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  onSnapshot,
  query,
  where,
  collection,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  startAt,
  doc,
  getDoc,
  type DocumentData,
  type Query,
  type FirestoreError,
  type CollectionReference,
  type Unsubscribe,
} from 'firebase/firestore';

import { useFirestore } from '@/firebase/provider';

type UseCollectionOptions = {
  query?: [string, '==', any];
  orderBy?: [string, 'asc' | 'desc'];
  limit?: number;
  startAfter?: any;
  endBefore?: any;
};

export function useCollection<T extends DocumentData>(
  collectionName: string,
  options?: UseCollectionOptions
) {
  const firestore = useFirestore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const collectionRef = useMemo(
    () => (firestore ? collection(firestore, collectionName) : null),
    [firestore, collectionName]
  );

  const queryRef = useMemo(() => {
    if (!collectionRef) return null;
    let q: Query = collectionRef;
    if (options?.query) {
      q = query(q, where(options.query[0], options.query[1], options.query[2]));
    }
    if (options?.orderBy) {
      q = query(q, orderBy(options.orderBy[0], options.orderBy[1]));
    }
    if (options?.startAfter) {
      q = query(q, startAfter(options.startAfter));
    }
    if (options?.endBefore) {
      q = query(q, endBefore(options.endBefore));
    }
    if (options?.limit) {
      q = query(q, limit(options.limit));
    }
    return q;
  }, [collectionRef, options]);


  useEffect(() => {
    if (!queryRef) return;
    const unsubscribe: Unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [queryRef]);

  return { data, loading, error };
}

export function useLazyCollection<T extends DocumentData>(
  collectionName: string
) {
  const firestore = useFirestore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);

  const collectionRef = useMemo(
    () => (firestore ? collection(firestore, collectionName) : null),
    [firestore, collectionName]
  );

  const getCollection = async (options?: UseCollectionOptions) => {
    if (!collectionRef) return;
    setLoading(true);
    try {
      let q: Query = collectionRef;
      if (options?.query) {
        q = query(q, where(options.query[0], options.query[1], options.query[2]));
      }
      if (options?.orderBy) {
        q = query(q, orderBy(options.orderBy[0], options.orderBy[1]));
      }
      if (options?.startAfter) {
        q = query(q, startAfter(options.startAfter));
      }
      if (options?.endBefore) {
        q = query(q, endBefore(options.endBefore));
      }
      if (options?.limit) {
        q = query(q, limit(options.limit));
      }
      const snapshot = await getDoc(q as any);
      const docs = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
      setData(docs);
    } catch (err) {
      setError(err as FirestoreError);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, getCollection };
}
