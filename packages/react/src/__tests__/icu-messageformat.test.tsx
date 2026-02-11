import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { T } from '../T';
import { t } from '../translate';
import { VocoderProvider } from '../VocoderProvider';

const mockTranslations = {
  en: {
    // Pluralization examples
    '{count, plural, =0 {No items} one {# item} other {# items}}':
      '{count, plural, =0 {No items} one {# item} other {# items}}',
    '{count, plural, =0 {No messages} one {You have # message} other {You have # messages}}':
      '{count, plural, =0 {No messages} one {You have # message} other {You have # messages}}',

    // Select examples
    '{gender, select, male {He} female {She} other {They}} replied':
      '{gender, select, male {He} female {She} other {They}} replied',
  },
  es: {
    // Spanish pluralization rules
    '{count, plural, =0 {No items} one {# item} other {# items}}':
      '{count, plural, =0 {Sin artículos} one {# artículo} other {# artículos}}',
    '{count, plural, =0 {No messages} one {You have # message} other {You have # messages}}':
      '{count, plural, =0 {Sin mensajes} one {Tienes # mensaje} other {Tienes # mensajes}}',
  },
};

function TestWrapper({ children, locale = 'en' }: { children: React.ReactNode; locale?: string }) {
  return (
    <VocoderProvider translations={mockTranslations} defaultLocale={locale}>
      {children}
    </VocoderProvider>
  );
}

describe('ICU MessageFormat - Phase 2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('<T> Component', () => {
    it('handles plural with count=0', () => {
      render(
        <TestWrapper locale="en">
          <T count={0}>{'{count, plural, =0 {No items} one {# item} other {# items}}'}</T>
        </TestWrapper>
      );

      expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('handles plural with count=1', () => {
      render(
        <TestWrapper locale="en">
          <T count={1}>{'{count, plural, =0 {No items} one {# item} other {# items}}'}</T>
        </TestWrapper>
      );

      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('handles plural with count=5', () => {
      render(
        <TestWrapper locale="en">
          <T count={5}>{'{count, plural, =0 {No items} one {# item} other {# items}}'}</T>
        </TestWrapper>
      );

      expect(screen.getByText('5 items')).toBeInTheDocument();
    });

    it('handles Spanish pluralization', () => {
      render(
        <TestWrapper locale="es">
          <T count={3}>{'{count, plural, =0 {No items} one {# item} other {# items}}'}</T>
        </TestWrapper>
      );

      expect(screen.getByText('3 artículos')).toBeInTheDocument();
    });

    it('handles select syntax for gender', () => {
      render(
        <TestWrapper locale="en">
          <T gender="female">{'{gender, select, male {He} female {She} other {They}} replied'}</T>
        </TestWrapper>
      );

      expect(screen.getByText('She replied')).toBeInTheDocument();
    });

    it('handles complex plural with text', () => {
      render(
        <TestWrapper locale="en">
          <T count={1}>
            {'{count, plural, =0 {No messages} one {You have # message} other {You have # messages}}'}
          </T>
        </TestWrapper>
      );

      expect(screen.getByText('You have 1 message')).toBeInTheDocument();
    });

    it('handles complex plural with multiple items', () => {
      render(
        <TestWrapper locale="en">
          <T count={42}>
            {'{count, plural, =0 {No messages} one {You have # message} other {You have # messages}}'}
          </T>
        </TestWrapper>
      );

      expect(screen.getByText('You have 42 messages')).toBeInTheDocument();
    });
  });

  describe('t() Function', () => {
    it('formats plural with t() function', () => {
      render(
        <TestWrapper locale="en">
          <div>Mounted</div>
        </TestWrapper>
      );

      const result = t('{count, plural, =0 {No items} one {# item} other {# items}}', { count: 3 });
      expect(result).toBe('3 items');
    });

    it('formats plural with count=0', () => {
      render(
        <TestWrapper locale="en">
          <div>Mounted</div>
        </TestWrapper>
      );

      const result = t('{count, plural, =0 {No items} one {# item} other {# items}}', { count: 0 });
      expect(result).toBe('No items');
    });

    it('formats select with t() function', () => {
      render(
        <TestWrapper locale="en">
          <div>Mounted</div>
        </TestWrapper>
      );

      const result = t('{gender, select, male {He} female {She} other {They}} replied', {
        gender: 'male',
      });
      expect(result).toBe('He replied');
    });
  });
});
