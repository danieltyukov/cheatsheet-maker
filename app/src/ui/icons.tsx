// One 24-unit grid, 1.75 stroke, round caps. Every icon is a single path string.
const PATHS = {
    select: 'M5 3l13 7.5-5.6 1.4L9.5 18z M12.4 11.9l4.6 6.1',
    hand: 'M8 12V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4.5a1.5 1.5 0 0 1 3 0V11 M14 10.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4.1-2.1L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5',
    pen: 'M4 20l1.2-4.4L15.6 5.2a2.1 2.1 0 0 1 3 3L8.2 18.6z M13.8 7l3 3',
    highlighter: 'M9 15l-3.5 3.5H3l2-2 M9 15l-2.5-2.5 8-8a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3l-8 8z M12 21h9',
    eraser: 'M8.5 20H20 M4.6 15.4l9.8-9.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8.2a2 2 0 0 1-1.4-.6l-2.2-2.2a1.3 1.3 0 0 1 0-1.8z M9.5 10.5l5 5',
    text: 'M5 6V4h14v2 M12 4v16 M9 20h6',
    rect: 'M4 6h16v12H4z',
    ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
    line: 'M5 19L19 5',
    arrow: 'M5 19L19 5 M10 5h9v9',
    crop: 'M6 2v14a2 2 0 0 0 2 2h14 M2 6h14a2 2 0 0 1 2 2v14',
    image: 'M4 5h16v14H4z M4 16l5-5 4 4 2-2 5 5 M15 9.5a1.5 1.5 0 1 0 0-.01',
    slides: 'M3 4h18v12H3z M12 16v4 M8 20h8 M7 8h6 M7 11h10',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    paste: 'M9 4h6v3H9z M15 5h3v16H6V5h3 M9 12h6 M9 16h4',
    pagePlus: 'M6 3h8l4 4v14H6z M14 3v4h4 M12 11v6 M9 14h6',
    undo: 'M9 14L4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3',
    redo: 'M15 14l5-5-5-5 M20 9H9a5 5 0 0 0 0 10h3',
    trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
    duplicate: 'M8 8h12v12H8z M16 8V4H4v12h4',
    forward: 'M9 9h11v11H9z M15 9V4H4v11h5',
    backward: 'M4 4h11v11H4z M9 15v5h11V9h-5',
    toFront: 'M7 7h10v10H7z M3 3v3 M3 3h3 M21 21v-3 M21 21h-3 M21 3h-3 M21 3v3 M3 21h3 M3 21v-3',
    toBack: 'M3 3h7v7H3z M14 14h7v7h-7z M14 10V3h7v7z M3 14h7v7H3z',
    alignLeft: 'M4 3v18 M8 7h10v4H8z M8 14h6v4H8z',
    alignHCenter: 'M12 3v18 M6 7h12v4H6z M8 14h8v4H8z',
    alignRight: 'M20 3v18 M6 7h10v4H6z M10 14h6v4h-6z',
    alignTop: 'M3 4h18 M7 8h4v10H7z M14 8h4v6h-4z',
    alignVCenter: 'M3 12h18 M7 6h4v12H7z M14 8h4v8h-4z',
    alignBottom: 'M3 20h18 M7 6h4v10H7z M14 10h4v6h-4z',
    distributeH: 'M4 3v18 M20 3v18 M10 7h4v10h-4z',
    distributeV: 'M3 4h18 M3 20h18 M7 10h10v4H7z',
    pack: 'M3 3h10v8H3z M15 3h6v5h-6z M15 10h6v11h-6z M3 13h10v8H3z',
    fit: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5 M8 8h8v8H8z',
    zoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M15.5 15.5L20 20 M10.5 8v5 M8 10.5h5',
    zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M15.5 15.5L20 20 M8 10.5h5',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    system: 'M3 5h18v11H3z M8 20h8 M12 16v4 M12 5v11',
    library: 'M4 4h6v7H4z M14 4h6v7h-6z M4 15h6v5H4z M14 15h6v5h-6z',
    download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
    check: 'M5 12.5l4.5 4.5L19 7',
    warning: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
    lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    unlock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
    rotate: 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v5h-5',
    close: 'M6 6l12 12 M18 6L6 18',
    more: 'M5 12h.01 M12 12h.01 M19 12h.01',
    keyboard: 'M3 6h18v12H3z M7 10h.01 M11 10h.01 M15 10h.01 M7 14h10',
    chevronDown: 'M6 9l6 6 6-6',
    chevronUp: 'M6 15l6-6 6 6',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    trim: 'M7 3v4 M3 7h4 M17 21v-4 M21 17h-4 M7 7h10v10H7z',
    invert: 'M12 4a8 8 0 1 0 0 16z M12 4a8 8 0 0 1 0 16',
    file: 'M6 3h8l4 4v14H6z M14 3v4h4',
    pages: 'M8 3h11v15H8z M5 6v15h11',
    sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4',
    shapes: 'M3 13h8v8H3z M17 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M7 3l4 7H3z M14 21l7-7',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d={PATHS[name]} />
        </svg>
    );
}
