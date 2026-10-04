// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { webPlatform } from './web';

test('saving without the File System Access API clicks a download link', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    expect(await webPlatform.saveFile('a.pdf', new Blob(['x']), 'pdf')).toBe('saved');
    expect(click).toHaveBeenCalledOnce();
});

test('the web has no legacy autosave', async () => {
    expect(await webPlatform.readLegacyAutosave()).toBeNull();
});
