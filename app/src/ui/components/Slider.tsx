import { useId } from 'react';

interface Props {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (v: number) => void;
    format?: (v: number) => string;
    /** Called on pointer down and up, so one drag can be one undo step. */
    onStart?: () => void;
    onEnd?: () => void;
}

export function Slider({ label, min, max, step, value, onChange, format, onStart, onEnd }: Props) {
    const id = useId();
    return (
        <div className="field slider">
            <div className="field-row">
                <label htmlFor={id}>{label}</label>
                <output htmlFor={id}>{format ? format(value) : value}</output>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                onPointerDown={onStart}
                onPointerUp={onEnd}
                onKeyDown={(e) => e.key.startsWith('Arrow') && onStart?.()}
                onKeyUp={(e) => e.key.startsWith('Arrow') && onEnd?.()}
            />
        </div>
    );
}
