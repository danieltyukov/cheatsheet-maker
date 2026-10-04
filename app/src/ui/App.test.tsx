// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders the product name', () => {
    render(<App />);
    expect(screen.getByText('Cheatsheet Maker')).toBeInTheDocument();
});
