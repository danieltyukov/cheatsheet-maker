import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { importLegacyAutosave } from './legacy';
import { FormatError } from './format';

const fixture = readFileSync(new URL('../test/fixtures/legacy-autosave.json', import.meta.url), 'utf8');

test('maps the GTK autosave onto version 1', async () => {
    const { doc, assets } = await importLegacyAutosave(fixture, 'Old sheet');
    expect(doc.title).toBe('Old sheet');
    expect(doc.setup.size).toBe('A4');
    expect(doc.pages).toHaveLength(2);
    const [img, stroke] = doc.pages[0].items;
    expect(img).toMatchObject({ kind: 'image', x: 10, y: 20, w: 100, h: 50, crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(stroke).toMatchObject({ kind: 'stroke', tool: 'pen', color: '#ff000080', size: 3 });
    expect(img.kind === 'image' && doc.assets[img.assetId]).toMatchObject({ mime: 'image/png', width: 1, height: 1 });
    expect(assets.size).toBe(1);
});

test('rejects JSON that is not an autosave', async () => {
    await expect(importLegacyAutosave('{"hello": 1}')).rejects.toThrow(FormatError);
    await expect(importLegacyAutosave('not json')).rejects.toThrow(FormatError);
});
