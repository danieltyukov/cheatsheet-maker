import type { Actions } from '../actions';
import type { MenuItem } from '../components/Menu';
import { ACCEPT } from '../../platform/classify';

export interface MenuContext {
    actions: Actions;
    mod: string;
    coarse: boolean;
    selectionCount: number;
    showGuides: boolean;
}

export function insertItems({ actions, mod, coarse }: MenuContext): MenuItem[] {
    const pick = (accept: string, multiple: boolean, capture = false) =>
        void actions.platform.pickFiles(accept, multiple, capture).then((f) => actions.importFiles(f));
    return [
        { label: 'Images', icon: 'image', shortcut: `${mod}+O`, onSelect: () => pick(ACCEPT.images, true) },
        { label: 'Paste', icon: 'paste', shortcut: `${mod}+V`, onSelect: () => void actions.pasteFromClipboard() },
        ...(coarse ? [{ label: 'Camera', icon: 'camera' as const, onSelect: () => pick(ACCEPT.images, false, true) }] : []),
        { label: 'From a PDF', icon: 'slides', shortcut: `${mod}+Shift+O`, onSelect: () => pick(ACCEPT.pdf, false) },
        { label: 'Text box', icon: 'text', shortcut: 'T', onSelect: () => actions.store.setTool('text') },
        'separator',
        { label: 'New page', icon: 'pagePlus', shortcut: `${mod}+Enter`, onSelect: () => actions.addPage() },
    ];
}

export function layoutItems({ actions, selectionCount }: MenuContext): MenuItem[] {
    const none = selectionCount === 0;
    return [
        { label: 'Auto-pack: fill the page', icon: 'fit', onSelect: () => actions.pack('fit') },
        { label: 'Auto-pack: keep sizes', icon: 'pack', onSelect: () => actions.pack('arrange') },
        'separator',
        { label: 'Align left', icon: 'alignLeft', disabled: none, onSelect: () => actions.align('left') },
        { label: 'Align centres', icon: 'alignHCenter', disabled: none, onSelect: () => actions.align('hcenter') },
        { label: 'Align right', icon: 'alignRight', disabled: none, onSelect: () => actions.align('right') },
        { label: 'Align top', icon: 'alignTop', disabled: none, onSelect: () => actions.align('top') },
        { label: 'Align middles', icon: 'alignVCenter', disabled: none, onSelect: () => actions.align('vcenter') },
        { label: 'Align bottom', icon: 'alignBottom', disabled: none, onSelect: () => actions.align('bottom') },
        'separator',
        { label: 'Distribute horizontally', icon: 'distributeH', disabled: selectionCount < 3, onSelect: () => actions.distribute('h') },
        { label: 'Distribute vertically', icon: 'distributeV', disabled: selectionCount < 3, onSelect: () => actions.distribute('v') },
        'separator',
        { label: 'Bring to front', icon: 'toFront', disabled: none, onSelect: () => actions.reorder('front') },
        { label: 'Bring forward', icon: 'forward', disabled: none, onSelect: () => actions.reorder('forward') },
        { label: 'Send backward', icon: 'backward', disabled: none, onSelect: () => actions.reorder('backward') },
        { label: 'Send to back', icon: 'toBack', disabled: none, onSelect: () => actions.reorder('back') },
    ];
}

export function viewItems({ actions, mod, showGuides }: MenuContext): MenuItem[] {
    return [
        { label: 'Zoom in', icon: 'zoomIn', shortcut: `${mod}+plus`, onSelect: () => actions.zoomBy(1.2) },
        { label: 'Zoom out', icon: 'zoomOut', shortcut: `${mod}+minus`, onSelect: () => actions.zoomBy(1 / 1.2) },
        { label: 'Actual size', shortcut: `${mod}+0`, onSelect: () => actions.zoomActual() },
        { label: 'Fit width', shortcut: `${mod}+1`, onSelect: () => actions.zoomFit() },
        'separator',
        { label: 'Show margins and columns', checked: showGuides, onSelect: () => actions.store.patch({ showGuides: !showGuides }) },
    ];
}

export function exportItems({ actions, mod }: MenuContext): MenuItem[] {
    return [
        { label: 'PDF', icon: 'download', shortcut: `${mod}+E`, onSelect: () => void actions.exportPdf() },
        { label: 'PNG of this page', icon: 'image', shortcut: `${mod}+Shift+E`, onSelect: () => void actions.exportPng() },
        { label: 'PNG of every page', icon: 'pages', onSelect: () => void actions.exportPng(actions.store.doc.pages.map((_, i) => i)) },
        { label: 'Save a .cheatsheet file', icon: 'file', shortcut: `${mod}+S`, onSelect: () => void actions.saveCheatsheet() },
        'separator',
        { label: 'Print check', icon: 'warning', onSelect: () => actions.store.openDialog('print-check') },
    ];
}
