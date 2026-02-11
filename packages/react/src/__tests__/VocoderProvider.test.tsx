import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { VocoderProvider, useVocoder } from '../VocoderProvider';

const mockTranslations = {
  en: {
    'Hello': 'Hello',
    'Goodbye': 'Goodbye',
  },
  es: {
    'Hello': 'Hola',
    'Goodbye': 'Adiós',
  },
  fr: {
    'Hello': 'Bonjour',
    'Goodbye': 'Au revoir',
  },
};

// Test component that uses the hook
function TestComponent() {
  const { locale, setLocale, t, availableLocales } = useVocoder();

  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="translation">{t('Hello')}</div>
      <div data-testid="available">{availableLocales.join(',')}</div>
      <button onClick={() => setLocale('es')}>Switch to Spanish</button>
      <button onClick={() => setLocale('fr')}>Switch to French</button>
    </div>
  );
}

describe('VocoderProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides translations to descendants', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <TestComponent />
      </VocoderProvider>
    );

    expect(screen.getByTestId('translation')).toHaveTextContent('Hello');
  });

  it('switches locales correctly', async () => {
    const user = userEvent.setup();

    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <TestComponent />
      </VocoderProvider>
    );

    // Initial locale
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(screen.getByTestId('translation')).toHaveTextContent('Hello');

    // Switch to Spanish
    await user.click(screen.getByText('Switch to Spanish'));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('es');
      expect(screen.getByTestId('translation')).toHaveTextContent('Hola');
    });
  });

  it('persists locale preference', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <TestComponent />
      </VocoderProvider>
    );

    // Switch to French
    await user.click(screen.getByText('Switch to French'));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    });

    // Unmount and remount
    unmount();

    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <TestComponent />
      </VocoderProvider>
    );

    // Should remember French
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    expect(screen.getByTestId('translation')).toHaveTextContent('Bonjour');
  });

  it('handles static translations mode', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <TestComponent />
      </VocoderProvider>
    );

    expect(screen.getByTestId('available')).toHaveTextContent('en,es,fr');
  });

  it('throws error when useVocoder is used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useVocoder must be used inside VocoderProvider');

    console.error = originalError;
  });
});
