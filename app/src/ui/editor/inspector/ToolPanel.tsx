import type { Actions } from '../../actions';
import { ColorSwatches } from '../../components/ColorSwatches';
import { NumberField } from '../../components/NumberField';
import { Segmented } from '../../components/Segmented';
import { Slider } from '../../components/Slider';
import { FILL_COLORS, HIGHLIGHTER_COLORS, INK_COLORS } from '../../palette';
import { useEditor, useStore, type Tool } from '../../store';
import { FONT_OPTIONS, TEXT_BACKGROUNDS } from './TextPanel';

const TITLES: Partial<Record<Tool, string>> = {
    pen: 'Pen', highlighter: 'Highlighter', eraser: 'Eraser', text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow',
};

export function ToolPanel({ tool }: { tool: Tool; actions?: Actions }) {
    const store = useStore();
    const o = useEditor((s) => s.options);
    const set = store.setOptions.bind(store);
    return (
        <section className="panel">
            <h3>{TITLES[tool] ?? 'Tool'}</h3>
            {tool === 'pen' && (
                <>
                    <ColorSwatches label="Colour" colors={INK_COLORS} value={o.penColor} onChange={(c) => c && set({ penColor: c })} />
                    <Slider label="Size" min={0.5} max={12} step={0.5} value={o.penSize} format={(v) => `${v} pt`} onChange={(penSize) => set({ penSize })} />
                </>
            )}
            {tool === 'highlighter' && (
                <>
                    <ColorSwatches label="Colour" colors={HIGHLIGHTER_COLORS} value={o.highlighterColor} onChange={(c) => c && set({ highlighterColor: c })} />
                    <Slider label="Size" min={4} max={32} step={1} value={o.highlighterSize} format={(v) => `${v} pt`} onChange={(highlighterSize) => set({ highlighterSize })} />
                </>
            )}
            {tool === 'eraser' && <p className="panel-hint">Drag across pen and highlighter strokes to remove them. Everything else is deleted with the select tool and Delete.</p>}
            {(tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') && (
                <>
                    <ColorSwatches label="Line colour" colors={INK_COLORS} value={o.shapeStroke} onChange={(c) => c && set({ shapeStroke: c })} />
                    <Slider label="Line width" min={0.25} max={8} step={0.25} value={o.shapeWidth} format={(v) => `${v} pt`} onChange={(shapeWidth) => set({ shapeWidth })} />
                    {(tool === 'rect' || tool === 'ellipse') && (
                        <ColorSwatches label="Fill" colors={FILL_COLORS} value={o.shapeFill} onChange={(shapeFill) => set({ shapeFill })} allowNone />
                    )}
                    <p className="panel-hint">Drag on the page. Hold Shift for squares, circles and 45 degree lines.</p>
                </>
            )}
            {tool === 'text' && (
                <>
                    <Segmented label="Font" value={o.text.font} options={FONT_OPTIONS} onChange={(font) => set({ text: { ...o.text, font } })} />
                    <NumberField label="Size" unit="pt" value={o.text.fontSize} min={3} max={96} step={0.5} onChange={(fontSize) => set({ text: { ...o.text, fontSize } })} />
                    <ColorSwatches label="Colour" colors={INK_COLORS} value={o.text.color} onChange={(c) => c && set({ text: { ...o.text, color: c } })} />
                    <ColorSwatches label="Background" colors={TEXT_BACKGROUNDS} value={o.text.background} onChange={(background) => set({ text: { ...o.text, background } })} allowNone />
                    <p className="panel-hint">Click the page to place a text box, or drag to set its width.</p>
                </>
            )}
        </section>
    );
}
