// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MenuButton } from './Menu';
import { Slider } from './Slider';
import { Segmented } from './Segmented';
import { ColorSwatches } from './ColorSwatches';

test('a menu opens, runs an item and closes', async () => {
    const onSelect = vi.fn();
    render(<MenuButton label="Export" items={[{ label: 'PDF', onSelect, shortcut: 'Ctrl+E' }, 'separator', { label: 'PNG', onSelect: () => {}, disabled: true }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menuitem', { name: /PNG/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
});

test('Escape closes a menu', async () => {
    render(<MenuButton label="More" items={[{ label: 'A', onSelect: () => {} }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
});

test('a slider reports numbers', () => {
    const onChange = vi.fn();
    render(<Slider label="Contrast" min={0.5} max={2} step={0.1} value={1} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Contrast'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith(1.5);
});

test('segmented control and swatches select values', async () => {
    const onAlign = vi.fn();
    render(<Segmented label="Align" value="left" onChange={onAlign} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Centre' }));
    expect(onAlign).toHaveBeenCalledWith('center');
    const onColor = vi.fn();
    render(<ColorSwatches label="Colour" colors={['#000000', '#c92a2a']} value="#000000" onChange={onColor} allowNone />);
    await userEvent.click(screen.getByRole('radio', { name: '#c92a2a' }));
    expect(onColor).toHaveBeenCalledWith('#c92a2a');
    await userEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(onColor).toHaveBeenCalledWith(null);
});
