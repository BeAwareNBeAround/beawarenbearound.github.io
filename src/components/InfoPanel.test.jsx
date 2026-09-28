import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { I18nProvider } from '@lingui/react';
import { activateLocale, i18n } from '../i18n/setup';
import { InfoPanel } from './InfoPanel';

function renderPanel() {
  activateLocale('en');
  return render(
    <I18nProvider i18n={i18n}>
      <InfoPanel summary="Guide">
        <h3>Setup</h3>
        <ul>
          <li>Item one</li>
          <li>Item two</li>
        </ul>
      </InfoPanel>
    </I18nProvider>,
  );
}

test('opens the dialog with its rich content on trigger click', () => {
  const { container } = renderPanel();

  fireEvent.click(screen.getByRole('button', { name: 'Guide' }));

  const dialog = container.querySelector('dialog');
  expect(dialog).toHaveAttribute('open');
  expect(screen.getByRole('heading', { name: 'Setup' })).toBeInTheDocument();
  expect(screen.getByText('Item one')).toBeInTheDocument();
  expect(screen.getByText('Item two')).toBeInTheDocument();
});

test('closes the dialog via the close button', () => {
  const { container } = renderPanel();
  const dialog = container.querySelector('dialog');

  fireEvent.click(screen.getByRole('button', { name: 'Guide' }));
  expect(dialog).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(dialog).not.toHaveAttribute('open');
});

test('closes the dialog when the backdrop receives a pointer down', () => {
  const { container } = renderPanel();
  const dialog = container.querySelector('dialog');

  fireEvent.click(screen.getByRole('button', { name: 'Guide' }));
  expect(dialog).toHaveAttribute('open');
  fireEvent.pointerDown(dialog);

  expect(dialog).not.toHaveAttribute('open');
});

test('keeps the dialog open when inner content receives a pointer down', () => {
  const { container } = renderPanel();
  const dialog = container.querySelector('dialog');

  fireEvent.click(screen.getByRole('button', { name: 'Guide' }));
  fireEvent.pointerDown(screen.getByText('Item one'));

  expect(dialog).toHaveAttribute('open');
});

test('exposes the trigger label and the close label to assistive technology', () => {
  renderPanel();

  const dialog = document.querySelector('dialog');
  expect(dialog).toHaveAttribute('aria-label', 'Guide');
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
});
