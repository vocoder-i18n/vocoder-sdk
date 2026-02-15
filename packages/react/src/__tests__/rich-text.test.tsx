import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { T } from '../T';
import { VocoderProvider } from '../VocoderProvider';

const mockTranslations = {
  en: {
    'Click <link>here</link> for help': 'Click <link>here</link> for help',
    'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>':
      'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>',
    'Contact <email>support@example.com</email> for assistance':
      'Contact <email>support@example.com</email> for assistance',
    'Visit <bold>our website</bold> to learn more':
      'Visit <bold>our website</bold> to learn more',
  },
  es: {
    'Click <link>here</link> for help': 'Haz clic <link>aquí</link> para obtener ayuda',
    'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>':
      'Lee nuestra <privacy>Política de Privacidad</privacy> y <terms>Términos de Servicio</terms>',
  },
};

function TestWrapper({ children, locale = 'en' }: { children: React.ReactNode; locale?: string }) {
  return (
    <VocoderProvider translations={mockTranslations} defaultLocale={locale}>
      {children}
    </VocoderProvider>
  );
}

describe('Rich Text with Components - Phase 3', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders text with single component placeholder', () => {
    render(
      <TestWrapper locale="en">
        <T components={{ link: <a href="/help" className="help-link" /> }}>
          Click <link>here</link> for help
        </T>
      </TestWrapper>
    );

    const linkElement = screen.getByText('here');
    expect(linkElement.tagName).toBe('A');
    expect(linkElement).toHaveAttribute('href', '/help');
    expect(linkElement).toHaveClass('help-link');
    expect(screen.getByText(/Click.*for help/)).toBeInTheDocument();
  });

  it('renders text with multiple component placeholders', () => {
    render(
      <TestWrapper locale="en">
        <T
          components={{
            privacy: <a href="/privacy" />,
            terms: <a href="/terms" />,
          }}
        >
          Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>
        </T>
      </TestWrapper>
    );

    const privacyLink = screen.getByText('Privacy Policy');
    const termsLink = screen.getByText('Terms of Service');

    expect(privacyLink.tagName).toBe('A');
    expect(privacyLink).toHaveAttribute('href', '/privacy');

    expect(termsLink.tagName).toBe('A');
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('renders Spanish translation with component placeholders', () => {
    render(
      <TestWrapper locale="es">
        <T components={{ link: <a href="/ayuda" /> }}>
          Click <link>here</link> for help
        </T>
      </TestWrapper>
    );

    // Should render Spanish translation
    expect(screen.getByText('aquí')).toBeInTheDocument();
    expect(screen.getByText(/Haz clic.*para obtener ayuda/)).toBeInTheDocument();

    const linkElement = screen.getByText('aquí');
    expect(linkElement.tagName).toBe('A');
    expect(linkElement).toHaveAttribute('href', '/ayuda');
  });

  it('works with different component types', () => {
    render(
      <TestWrapper locale="en">
        <T
          components={{
            email: <a href="mailto:support@example.com" className="email-link" />,
          }}
        >
          Contact <email>support@example.com</email> for assistance
        </T>
      </TestWrapper>
    );

    const emailLink = screen.getByText('support@example.com');
    expect(emailLink.tagName).toBe('A');
    expect(emailLink).toHaveAttribute('href', 'mailto:support@example.com');
    expect(emailLink).toHaveClass('email-link');
  });

  it('works with styled components', () => {
    render(
      <TestWrapper locale="en">
        <T components={{ bold: <strong className="font-bold" /> }}>
          Visit <bold>our website</bold> to learn more
        </T>
      </TestWrapper>
    );

    const boldElement = screen.getByText('our website');
    expect(boldElement.tagName).toBe('STRONG');
    expect(boldElement).toHaveClass('font-bold');
  });

  it('falls back to plain text if component not provided', () => {
    // Suppress console.warn for this test
    const originalWarn = console.warn;
    console.warn = () => {};

    render(
      <TestWrapper locale="en">
        <T components={{}}>
          Click <link>here</link> for help
        </T>
      </TestWrapper>
    );

    // Should render the tag as plain text with warning
    expect(screen.getByText(/<link>here<\/link>/)).toBeInTheDocument();

    console.warn = originalWarn;
  });

  it('renders plain text when no components prop provided', () => {
    render(
      <TestWrapper locale="en">
        <T>Click <link>here</link> for help</T>
      </TestWrapper>
    );

    // Without components prop, should render plain text
    expect(screen.getByText(/Click.*here.*for help/)).toBeInTheDocument();
  });

  describe('Rich Text with msg prop', () => {
    it('renders rich text from msg prop with single component', () => {
      render(
        <TestWrapper locale="en">
          <T 
            msg="Click <link>here</link> for help"
            components={{ link: <a href="/help" className="help-link" /> }}
          />
        </TestWrapper>
      );

      const linkElement = screen.getByText('here');
      expect(linkElement.tagName).toBe('A');
      expect(linkElement).toHaveAttribute('href', '/help');
      expect(linkElement).toHaveClass('help-link');
      expect(screen.getByText(/Click.*for help/)).toBeInTheDocument();
    });

    it('renders rich text from msg prop with multiple components', () => {
      render(
        <TestWrapper locale="en">
          <T 
            msg="Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>"
            components={{
              privacy: <a href="/privacy" className="privacy-link" />,
              terms: <a href="/terms" className="terms-link" />,
            }}
          />
        </TestWrapper>
      );

      const privacyLink = screen.getByText('Privacy Policy');
      expect(privacyLink.tagName).toBe('A');
      expect(privacyLink).toHaveAttribute('href', '/privacy');
      expect(privacyLink).toHaveClass('privacy-link');

      const termsLink = screen.getByText('Terms of Service');
      expect(termsLink.tagName).toBe('A');
      expect(termsLink).toHaveAttribute('href', '/terms');
      expect(termsLink).toHaveClass('terms-link');
    });

    it('translates rich text from msg prop', () => {
      render(
        <TestWrapper locale="es">
          <T 
            msg="Click <link>here</link> for help"
            components={{ link: <a href="/help" /> }}
          />
        </TestWrapper>
      );

      const linkElement = screen.getByText('aquí');
      expect(linkElement.tagName).toBe('A');
      expect(screen.getByText(/Haz clic.*para obtener ayuda/)).toBeInTheDocument();
    });

    it('works with msg prop and styled components', () => {
      render(
        <TestWrapper locale="en">
          <T 
            msg="Visit <bold>our website</bold> to learn more"
            components={{ bold: <strong className="font-bold" /> }}
          />
        </TestWrapper>
      );

      const boldElement = screen.getByText('our website');
      expect(boldElement.tagName).toBe('STRONG');
      expect(boldElement).toHaveClass('font-bold');
    });

    it('prefers msg prop over children for rich text', () => {
      render(
        <TestWrapper locale="en">
          <T 
            msg="Click <link>here</link> for help"
            components={{ link: <a href="/help" className="help-link" /> }}
          >
            This should be ignored
          </T>
        </TestWrapper>
      );

      const linkElement = screen.getByText('here');
      expect(linkElement).toBeInTheDocument();
      expect(screen.queryByText('This should be ignored')).not.toBeInTheDocument();
    });
  });
});
