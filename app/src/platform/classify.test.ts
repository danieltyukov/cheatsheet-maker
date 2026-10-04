import { expect, test } from 'vitest';
import { classifyFile } from './classify';

test.each([
    ['shot.png', 'image/png', 'image'],
    ['photo.HEIC', '', 'unknown'],
    ['scan.jpg', '', 'image'],
    ['slides.pdf', 'application/pdf', 'pdf'],
    ['Exam.cheatsheet', '', 'cheatsheet'],
    ['Exam.cheatsheet', 'application/zip', 'cheatsheet'],
    ['autosave.json', 'application/json', 'legacy-json'],
    ['notes.txt', 'text/plain', 'unknown'],
])('%s (%s) is %s', (name, mime, kind) => {
    expect(classifyFile(name, mime)).toBe(kind);
});
