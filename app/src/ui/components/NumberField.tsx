import { useEffect, useId, useState } from 'react';

interface Props {
    label: string;
    value: number;
    onChange: (v: number) => void;
    unit?: string;
    step?: number;
    min?: number;
    max?: number;
    digits?: number;
}

export function NumberField({ label, value, onChange, unit, step = 1, min, max, digits = 1 }: Props) {
    const id = useId();
    const shown = Number(value.toFixed(digits)).toString();
    const [text, setText] = useState(shown);
    useEffect(() => setText(shown), [shown]);

    const commit = () => {
        const n = Number(text.replace(',', '.'));
        if (!Number.isFinite(n) || text.trim() === '') {
            setText(shown);
            return;
        }
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
        if (clamped !== value) onChange(clamped);
        else setText(shown);
    };

    return (
        <div className="field number-field">
            <label htmlFor={id} className="field-label">{label}</label>
            <div className="number-input">
                <input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    value={text}
                    step={step}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setText(shown);
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            const n = value + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1);
                            onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
                        }
                    }}
                />
                {unit && <span className="unit">{unit}</span>}
            </div>
        </div>
    );
}
