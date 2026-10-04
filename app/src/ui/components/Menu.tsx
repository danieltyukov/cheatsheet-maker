import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../icons';

export type MenuItem =
    | { label: string; onSelect: () => void; shortcut?: string; disabled?: boolean; icon?: IconName; checked?: boolean }
    | 'separator';

interface Props {
    label: string;
    items: MenuItem[];
    icon?: IconName;
    /** Show only the icon; the label becomes the accessible name. */
    iconOnly?: boolean;
    align?: 'start' | 'end';
    className?: string;
}

export function MenuButton({ label, items, icon, iconOnly = false, align = 'start', className = '' }: Props) {
    const [open, setOpen] = useState(false);
    const [up, setUp] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();

    const enabled = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])];

    useLayoutEffect(() => {
        if (!open || !menu.current || !wrap.current) return;
        const r = wrap.current.getBoundingClientRect();
        const h = menu.current.offsetHeight;
        setUp(r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0);
        enabled()[0]?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const away = (e: PointerEvent) => {
            if (!wrap.current?.contains(e.target as Node)) setOpen(false);
        };
        const blur = () => setOpen(false);
        document.addEventListener('pointerdown', away);
        window.addEventListener('blur', blur);
        return () => {
            document.removeEventListener('pointerdown', away);
            window.removeEventListener('blur', blur);
        };
    }, [open]);

    const close = (refocus: boolean) => {
        setOpen(false);
        if (refocus) trigger.current?.focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        const list = enabled();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close(true);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            list[(i + 1) % list.length]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            list[(i - 1 + list.length) % list.length]?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            list[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            list[list.length - 1]?.focus();
        } else if (e.key === 'Tab') {
            close(false);
        }
    };

    return (
        <div className={`menu-wrap ${className}`} ref={wrap} onKeyDown={onKeyDown}>
            <button
                ref={trigger}
                type="button"
                className={iconOnly ? 'icon-btn' : 'menu-trigger'}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                aria-label={iconOnly ? label : undefined}
                title={iconOnly ? label : undefined}
                onClick={() => setOpen((o) => !o)}
            >
                {icon && <Icon name={icon} size={iconOnly ? 20 : 18} />}
                {!iconOnly && <span>{label}</span>}
                {!iconOnly && <Icon name="chevronDown" size={14} />}
            </button>
            {open && (
                <div id={id} role="menu" aria-label={label} ref={menu} className={`menu ${align === 'end' ? 'menu-end' : ''} ${up ? 'menu-up' : ''}`}>
                    {items.map((item, i) =>
                        item === 'separator' ? (
                            <div key={i} role="separator" className="menu-sep" />
                        ) : (
                            <button
                                key={i}
                                type="button"
                                role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                                aria-checked={item.checked}
                                disabled={item.disabled}
                                className="menu-item"
                                onClick={() => {
                                    close(false);
                                    item.onSelect();
                                }}
                            >
                                <span className="menu-icon">
                                    {item.checked ? <Icon name="check" size={16} /> : item.icon ? <Icon name={item.icon} size={16} /> : null}
                                </span>
                                <span className="menu-label">{item.label}</span>
                                {item.shortcut && <kbd className="menu-shortcut">{item.shortcut}</kbd>}
                            </button>
                        ),
                    )}
                </div>
            )}
        </div>
    );
}
