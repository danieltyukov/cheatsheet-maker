import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../icons';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'default' | 'quiet' | 'danger';
    size?: 'sm' | 'md';
    icon?: IconName;
    children?: ReactNode;
}

export function Button({ variant = 'default', size = 'md', icon, children, className = '', type = 'button', ...rest }: Props) {
    return (
        <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
            {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
            {children && <span>{children}</span>}
        </button>
    );
}
