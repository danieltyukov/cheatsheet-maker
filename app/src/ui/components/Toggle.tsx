interface Props {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: Props) {
    return (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="toggle" onClick={() => onChange(!checked)}>
            <span className="toggle-label">{label}</span>
            <span className="toggle-track" aria-hidden="true">
                <span className="toggle-thumb" />
            </span>
        </button>
    );
}
