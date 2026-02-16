import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { T } from '../T';
import { VocoderProvider } from '../VocoderProvider';

describe('T component', () => {
  it('renders translated text', async () => {
    document.cookie = 'vocoder_locale=es; Path=/';

    render(
      <VocoderProvider>
        <T>Hello, world!</T>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Hola, mundo!')).toBeInTheDocument();
    });
  });

  it('interpolates variables', async () => {
    render(
      <VocoderProvider>
        <T name="John">Hello, {'{'}name{'}'}!</T>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello, John!')).toBeInTheDocument();
    });
  });

  it('uses msg prop over children', async () => {
    render(
      <VocoderProvider>
        <T msg="Hello, world!">Goodbye</T>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });
    expect(screen.queryByText('Goodbye')).not.toBeInTheDocument();
  });

  it('falls back to source text when translation does not exist', async () => {
    render(
      <VocoderProvider>
        <T>Untranslated text</T>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Untranslated text')).toBeInTheDocument();
    });
  });
});
