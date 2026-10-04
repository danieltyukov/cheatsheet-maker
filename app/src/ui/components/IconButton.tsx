import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from '../icons';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    label: string;
    icon: IconName;
    pressed?: boolean;
    shortcut?: string;
    size?: number;
}

export function IconButton({ label, icon, pressed, shortcut, size = 20, className = '', type = 'button', ...rest }: Props) {
    return (
        <button
            type={type}
            aria-label={label}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-pressed={pressed}
            className={`icon-btn ${pressed ? 'is-on' : ''} ${className}`}
            {...rest}
        >
            <Icon name={icon} size={size} />
        </button>
    );
}
