import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { t } from '../translate';
import { VocoderProvider } from '../VocoderProvider';

const mockTranslations = {
  en: {
    'Hello, world!': 'Hello, world!',
    'Hello, {name}!': 'Hello, {name}!',
    'You have {count} messages': 'You have {count} messages',
  },
  es: {
    'Hello, world!': '¡Hola, mundo!',
    'Hello, {name}!': '¡Hola, {name}!',
    'You have {count} messages': 'Tienes {count} mensajes',
  },
};

// Helper component to mount provider
function TestWrapper({ children, locale = 'en' }: { children: React.ReactNode; locale?: string }) {
  return (
    <VocoderProvider translations={mockTranslations} defaultLocale={locale}>
      {children}
    </VocoderProvider>
  );
}

describe('t() function', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('translates text after provider is mounted', () => {
    // Mount provider with English
    render(
      <TestWrapper locale="en">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    // Now t() should work
    expect(t('Hello, world!')).toBe('Hello, world!');
  });

  it('translates to Spanish after provider is mounted with es locale', () => {
    // Mount provider with Spanish
    render(
      <TestWrapper locale="es">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    // Now t() should return Spanish
    expect(t('Hello, world!')).toBe('¡Hola, mundo!');
  });

  it('interpolates variables correctly', () => {
    render(
      <TestWrapper locale="en">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    expect(t('Hello, {name}!', { name: 'John' })).toBe('Hello, John!');
  });

  it('interpolates variables in Spanish', () => {
    render(
      <TestWrapper locale="es">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    expect(t('You have {count} messages', { count: 5 })).toBe('Tienes 5 mensajes');
  });

  it('falls back to source text when translation not found', () => {
    render(
      <TestWrapper locale="en">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    expect(t('Untranslated text')).toBe('Untranslated text');
  });

  it('handles missing variables gracefully', () => {
    render(
      <TestWrapper locale="en">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    expect(t('Hello, {name}!')).toBe('Hello, {name}!');
  });

  it('preserves whitespace around interpolated values (regression test)', () => {
    // This test ensures that "Tienes {count} mensajes" with count=1
    // renders as "Tienes 1 mensajes" (with spaces), not "Tienes1mensajes"
    render(
      <TestWrapper locale="es">
        <div>Provider mounted</div>
      </TestWrapper>
    );

    const result = t('You have {count} messages', { count: 1 });

    // Verify the result is a string (not array)
    expect(typeof result).toBe('string');

    // Verify spaces are preserved around the interpolated value
    expect(result).toBe('Tienes 1 mensajes');
    expect(result).not.toBe('Tienes1mensajes'); // NOT smashed together
  });
});
