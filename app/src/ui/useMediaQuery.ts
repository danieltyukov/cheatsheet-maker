import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (cb) => {
            if (typeof matchMedia !== 'function') return () => {};
            const m = matchMedia(query);
            m.addEventListener?.('change', cb);
            return () => m.removeEventListener?.('change', cb);
        },
        () => (typeof matchMedia === 'function' ? matchMedia(query).matches : true),
        () => true,
    );
}
