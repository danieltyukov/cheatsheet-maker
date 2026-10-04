import { useEffect } from 'react';
import { IconButton } from './IconButton';

export interface ToastView {
    id: number;
    message: string;
    kind: 'info' | 'error';
    action?: { label: string; run: () => void };
}

function ToastRow({ t, onDismiss }: { t: ToastView; onDismiss: (id: number) => void }) {
    useEffect(() => {
        if (t.kind !== 'info' || t.action) return;
        const timer = setTimeout(() => onDismiss(t.id), 5000);
        return () => clearTimeout(timer);
    }, [t, onDismiss]);
    return (
        <div className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
                <button
                    type="button"
                    className="toast-action"
                    onClick={() => {
                        onDismiss(t.id);
                        t.action!.run();
                    }}
                >
                    {t.action.label}
                </button>
            )}
            <IconButton label="Dismiss" icon="close" size={16} onClick={() => onDismiss(t.id)} />
        </div>
    );
}

export function Toasts({ toasts, onDismiss }: { toasts: ToastView[]; onDismiss: (id: number) => void }) {
    return (
        <div className="toasts">
            {toasts.map((t) => (
                <ToastRow key={t.id} t={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
}
