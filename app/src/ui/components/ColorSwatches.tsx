import { useId } from 'react';

interface Props {
    label: string;
    colors: string[];
    value: string | null;
    onChange: (v: string | null) => void;
    allowNone?: boolean;
}

/** Keeps the alpha suffix of the current colour when a custom colour is picked. */
function withAlphaOf(hex: string, current: string | null): string {
    const alpha = current && current.length === 9 ? current.slice(7) : '';
    return hex + alpha;
}

export function ColorSwatches({ label, colors, value, onChange, allowNone = false }: Props) {
    const customId = useId();
    const custom = value !== null && !colors.includes(value);
    return (
        <div className="field">
            <span className="field-label">{label}</span>
            <div role="radiogroup" aria-label={label} className="swatches">
                {allowNone && (
                    <button type="button" role="radio" aria-checked={value === null} aria-label="None" title="None" className="swatch swatch-none" onClick={() => onChange(null)} />
                )}
                {colors.map((c) => (
                    <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={value === c}
                        aria-label={c}
                        title={c}
                        className="swatch"
                        style={{ ['--swatch' as string]: c }}
                        onClick={() => onChange(c)}
                    />
                ))}
                <label className={`swatch swatch-custom ${custom ? 'is-custom' : ''}`} title="Custom colour" htmlFor={customId} style={custom ? { ['--swatch' as string]: value } : undefined}>
                    <span className="visually-hidden">Custom colour</span>
                    <input
                        id={customId}
                        type="color"
                        value={(value ?? '#000000').slice(0, 7)}
                        onChange={(e) => onChange(withAlphaOf(e.target.value, value))}
                    />
                </label>
            </div>
        </div>
    );
}
