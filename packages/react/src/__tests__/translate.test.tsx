import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { t } from '../translate';
import { VocoderProvider } from '../VocoderProvider';

function mountProvider() {
  return render(
    <VocoderProvider>
      <div>mounted</div>
    </VocoderProvider>,
  );
}

describe('t() function', () => {
  it('translates using generated locale data', async () => {
    mountProvider();

    await waitFor(() => {
      expect(t('Hello, world!')).toBe('Hello, world!');
    });
  });

  it('uses cookie-selected locale', async () => {
    document.cookie = 'vocoder_locale=es; Path=/';
    mountProvider();

    await waitFor(() => {
      expect(t('Hello, world!')).toBe('Hola, mundo!');
    });
  });

  it('formats interpolation values', async () => {
    mountProvider();

    await waitFor(() => {
      expect(t('You have {count} messages', { count: 3 })).toBe('You have 3 messages');
    });
  });

  it('returns source text when translation is missing', async () => {
    mountProvider();

    await waitFor(() => {
      expect(t('Missing translation')).toBe('Missing translation');
    });
  });
});
