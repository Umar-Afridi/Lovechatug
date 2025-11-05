import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

type Events = {
  'permission-error': (error: FirestorePermissionError) => void;
};

// This is a hack to get around the fact that EventEmitter is not typed
// and use it in a type-safe way.
class TypedEventEmitter<T> {
    private emitter = new EventEmitter();

    emit<K extends keyof T>(event: K, ...args: T[K] extends (...args: any[]) => any ? Parameters<T[K]> : never) {
        this.emitter.emit(event as string, ...args);
    }

    on<K extends keyof T>(event: K, listener: T[K]) {
        this.emitter.on(event as string, listener as (...args: any[]) => void);
    }

    off<K extends keyof T>(event: K, listener: T[K]) {
        this.emitter.off(event as string, listener as (...args: any[]) => void);
    }
}

export const errorEmitter = new TypedEventEmitter<Events>();
