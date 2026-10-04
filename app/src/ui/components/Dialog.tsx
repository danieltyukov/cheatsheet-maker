import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
}

export function Dialog({ open, title, onClose, children, footer, className = '' }: Props) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            // Older browsers and jsdom lack showModal; the open attribute still shows the dialog.
            if (typeof d.showModal === 'function') d.showModal();
            else d.setAttribute('open', '');
        } else if (!open && d.open) {
            if (typeof d.close === 'function') d.close();
            else d.removeAttribute('open');
        }
    }, [open]);

    if (!open) return null;
    return (
        <dialog
            ref={ref}
            className={`dialog ${className}`}
            aria-labelledby={titleId}
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
            onClick={(e) => {
                if (e.target === ref.current) onClose();
            }}
        >
            <div className="dialog-inner">
                <header className="dialog-head">
                    <h2 id={titleId}>{title}</h2>
                    <IconButton label="Close" icon="close" onClick={onClose} />
                </header>
                <div className="dialog-body">{children}</div>
                {footer && <footer className="dialog-foot">{footer}</footer>}
            </div>
        </dialog>
    );
}
