import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ClickCounter } from './ClickCounter';

test('shows the loading state', () => {
  render(<ClickCounter label="Global Clicks:" loading className="counter-box" />);

  const element = screen.getByText('Loading counts...');
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass('view-counter', 'loading', 'counter-box');
});

test('shows the unavailable state on error', () => {
  render(<ClickCounter label="Global Clicks:" error="HTTP Error 500" className="counter-box" />);

  const element = screen.getByText('Unavailable');
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass('view-counter', 'error', 'counter-box');
});

test('renders the label and the formatted count', () => {
  const { container } = render(
    <ClickCounter count={1234} label="Global Clicks:" className="counter-box" />,
  );

  expect(screen.getByText('Global Clicks:')).toBeInTheDocument();
  expect(screen.getByText('1,234')).toBeInTheDocument();
  expect(container.firstChild).toHaveClass('counter-box');
});
