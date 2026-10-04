import type { KeyboardEvent } from 'react';
import { Icon, type IconName } from '../icons';

interface Option<T> {
    value: T;
    label: string;
    icon?: IconName;
}

interface Props<T> {
    label: string;
    options: Option<T>[];
    value: T;
    onChange: (v: T) => void;
    hideLabel?: boolean;
}

export function Segmented<T extends string | number>({ label, options, value, onChange, hideLabel = false }: Props<T>) {
    const move = (e: KeyboardEvent, i: number) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = options[(i + d + options.length) % options.length];
        onChange(next.value);
        const group = (e.currentTarget as HTMLElement).parentElement;
        (group?.children[(i + d + options.length) % options.length] as HTMLElement | undefined)?.focus();
    };
    return (
        <div className="field">
            {!hideLabel && <span className="field-label">{label}</span>}
            <div role="radiogroup" aria-label={label} className="segmented">
                {options.map((o, i) => (
                    <button
                        key={String(o.value)}
                        type="button"
                        role="radio"
                        aria-checked={o.value === value}
                        aria-label={o.icon ? o.label : undefined}
                        title={o.icon ? o.label : undefined}
                        tabIndex={o.value === value ? 0 : -1}
                        className={o.value === value ? 'is-on' : ''}
                        onClick={() => onChange(o.value)}
                        onKeyDown={(e) => move(e, i)}
                    >
                        {o.icon ? <Icon name={o.icon} size={18} /> : o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
