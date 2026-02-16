import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { T } from '../T';
import { t } from '../translate';
import { VocoderProvider } from '../VocoderProvider';

describe('ICU MessageFormat', () => {
  it('formats plural messages with <T>', async () => {
    render(
      <VocoderProvider>
        <T count={5}>{'{count, plural, =0 {No items} one {# item} other {# items}}'}</T>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('5 items')).toBeInTheDocument();
    });
  });

  it('formats translated plural messages', async () => {
    document.cookie = 'vocoder_locale=es; Path=/';

    render(
      <VocoderProvider>
        <T count={3}>{'{count, plural, =0 {No items} one {# item} other {# items}}'}</T>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('3 articulos')).toBeInTheDocument();
    });
  });

  it('formats select messages with t()', async () => {
    render(
      <VocoderProvider>
        <div>mounted</div>
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(
        t('{gender, select, male {He} female {She} other {They}} replied', { gender: 'female' }),
      ).toBe('She replied');
    });
  });
});
