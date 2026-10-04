import type { IconName } from '../icons';
import { IconButton } from '../components/IconButton';
import { useEditor, useStore, type Tool } from '../store';

export const TOOLS: Array<{ tool: Tool; label: string; icon: IconName; key: string }> = [
    { tool: 'select', label: 'Select', icon: 'select', key: 'V' },
    { tool: 'hand', label: 'Hand', icon: 'hand', key: 'H' },
    { tool: 'pen', label: 'Pen', icon: 'pen', key: 'P' },
    { tool: 'highlighter', label: 'Highlighter', icon: 'highlighter', key: 'M' },
    { tool: 'eraser', label: 'Eraser', icon: 'eraser', key: 'E' },
    { tool: 'text', label: 'Text', icon: 'text', key: 'T' },
    { tool: 'rect', label: 'Rectangle', icon: 'rect', key: 'R' },
    { tool: 'ellipse', label: 'Ellipse', icon: 'ellipse', key: 'O' },
    { tool: 'line', label: 'Line', icon: 'line', key: 'L' },
    { tool: 'arrow', label: 'Arrow', icon: 'arrow', key: 'A' },
];

export function ToolRail() {
    const store = useStore();
    const tool = useEditor((s) => s.tool);
    return (
        <nav className="tool-rail" aria-label="Tools">
            {TOOLS.map((t, i) => (
                <div key={t.tool} className={i === 2 || i === 6 ? 'rail-gap' : undefined}>
                    <IconButton label={t.label} icon={t.icon} shortcut={t.key} pressed={tool === t.tool} onClick={() => store.setTool(t.tool)} />
                </div>
            ))}
        </nav>
    );
}
