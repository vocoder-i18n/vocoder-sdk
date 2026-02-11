import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { T } from '../T';
import { VocoderProvider } from '../VocoderProvider';

const mockTranslations = {
  en: {
    'Hello, world!': 'Hello, world!',
    'Welcome to our app!': 'Welcome to our app!',
    'Hello, {name}!': 'Hello, {name}!',
    'You have {count} messages': 'You have {count} messages',
  },
  es: {
    'Hello, world!': '¡Hola, mundo!',
    'Welcome to our app!': '¡Bienvenido a nuestra aplicación!',
    'Hello, {name}!': '¡Hola, {name}!',
    'You have {count} messages': 'Tienes {count} mensajes',
  },
};

describe('T Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear navigator.language mock if set
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
    }
  });

  it('renders source text when no translation exists', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <T>Untranslated text</T>
      </VocoderProvider>
    );

    expect(screen.getByText('Untranslated text')).toBeInTheDocument();
  });

  it('renders translated text when available', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="es">
        <T>Hello, world!</T>
      </VocoderProvider>
    );

    // Debug: check what was actually rendered
    const element = screen.getByText(/Hello|Hola/);
    console.log('Rendered text:', element.textContent);

    expect(screen.getByText('¡Hola, mundo!')).toBeInTheDocument();
  });

  it('interpolates variables correctly', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <T name="John">Hello, {'{'}name{'}'}!</T>
      </VocoderProvider>
    );

    expect(screen.getByText('Hello, John!')).toBeInTheDocument();
  });

  it('interpolates variables in Spanish', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="es">
        <T count={5}>You have {'{'}count{'}'} messages</T>
      </VocoderProvider>
    );

    // Debug: check what was actually rendered
    const element = screen.getByText(/messages|mensajes/);
    console.log('Rendered text:', element.textContent);

    expect(screen.getByText('Tienes 5 mensajes')).toBeInTheDocument();
  });

  it('handles missing variables gracefully', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <T>Hello, {'{'}name{'}'}!</T>
      </VocoderProvider>
    );

    // Should leave placeholder as-is when variable is missing
    expect(screen.getByText('Hello, {name}!')).toBeInTheDocument();
  });

  it('falls back to source text on error', () => {
    render(
      <VocoderProvider translations={mockTranslations} defaultLocale="en">
        <T>Source text</T>
      </VocoderProvider>
    );

    expect(screen.getByText('Source text')).toBeInTheDocument();
  });
});
