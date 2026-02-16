import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { T } from '../T';
import { VocoderProvider } from '../VocoderProvider';

describe('Rich text formatting', () => {
  it('renders component placeholders', async () => {
    render(
      <VocoderProvider>
        <T
          msg="Click <link>here</link> for help"
          components={{ link: <a href="/help" className="help-link" /> }}
        />
      </VocoderProvider>,
    );

    await waitFor(() => {
      const link = screen.getByText('here');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/help');
      expect(link).toHaveClass('help-link');
    });
  });

  it('renders translated component placeholders', async () => {
    document.cookie = 'vocoder_locale=es; Path=/';

    render(
      <VocoderProvider>
        <T
          msg="Click <link>here</link> for help"
          components={{ link: <a href="/ayuda" /> }}
        />
      </VocoderProvider>,
    );

    await waitFor(() => {
      const link = screen.getByText('aqui');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/ayuda');
    });
  });

  it('supports multiple component placeholders with msg prop', async () => {
    render(
      <VocoderProvider>
        <T
          msg="Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>"
          components={{
            privacy: <a href="/privacy" />,
            terms: <a href="/terms" />,
          }}
        />
      </VocoderProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy')).toHaveAttribute('href', '/privacy');
      expect(screen.getByText('Terms of Service')).toHaveAttribute('href', '/terms');
    });
  });
});
