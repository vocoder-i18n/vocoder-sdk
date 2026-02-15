import { describe, it, expect } from 'vitest';
import { StringAnalyzer } from '../utils/wrap/analyzer.js';
import { StringTransformer } from '../utils/wrap/transformer.js';
import { reactAdapter } from '../utils/wrap/adapters/react.js';

const analyzer = new StringAnalyzer(reactAdapter);
const transformer = new StringTransformer(reactAdapter);

describe('StringAnalyzer', () => {
  it('finds bare JSX text', () => {
    const code = `
      function App() {
        return <h1>Welcome to our app</h1>;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.text).toBe('Welcome to our app');
    expect(candidates[0]!.strategy).toBe('T-component');
    expect(candidates[0]!.context).toBe('jsx-text');
  });

  it('skips text already wrapped in <T>', () => {
    const code = `
      import { T } from '@vocoder/react';
      function App() {
        return <h1><T>Already wrapped</T></h1>;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.length).toBe(0);
  });

  it('finds translatable attributes', () => {
    const code = `
      function App() {
        return <input placeholder="Enter your name" />;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.length).toBeGreaterThan(0);
    const placeholder = candidates.find((c) => c.text === 'Enter your name');
    expect(placeholder).toBeDefined();
    expect(placeholder!.strategy).toBe('t-function');
  });

  it('skips non-translatable attributes', () => {
    const code = `
      function App() {
        return <div className="flex items-center p-4" id="main" />;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.length).toBe(0);
  });

  it('skips strings inside console.log', () => {
    const code = `
      function App() {
        console.log("Debug message");
        return <div>Hello world</div>;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    // Should find "Hello world" but NOT "Debug message"
    expect(candidates.some((c) => c.text === 'Debug message')).toBe(false);
    expect(candidates.some((c) => c.text === 'Hello world')).toBe(true);
  });

  it('skips import strings', () => {
    const code = `
      import React from 'react';
      import { useState } from 'react';
      function App() {
        return <div>Hello world</div>;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.some((c) => c.text === 'react')).toBe(false);
  });

  it('skips strings already wrapped in t()', () => {
    const code = `
      import { useVocoder } from '@vocoder/react';
      function App() {
        const { t } = useVocoder();
        return <input placeholder={t("Already wrapped")} />;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.some((c) => c.text === 'Already wrapped')).toBe(false);
  });

  it('finds multiple candidates in one file', () => {
    const code = `
      function App() {
        return (
          <div>
            <h1>Page Title</h1>
            <p>Welcome to our application</p>
            <button title="Click me">Submit</button>
          </div>
        );
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
  });

  it('detects aria-label as translatable', () => {
    const code = `
      function App() {
        return <nav aria-label="Main navigation">content</nav>;
      }
    `;
    const candidates = analyzer.analyzeCode(code);
    const ariaLabel = candidates.find((c) => c.text === 'Main navigation');
    expect(ariaLabel).toBeDefined();
    expect(ariaLabel!.confidence).toBe('high');
  });
});

describe('StringTransformer', () => {
  it('wraps JSX text with <T>', () => {
    const code = `function App() {
  return <h1>Welcome to our app</h1>;
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    expect(result.output).toContain('<T>');
    expect(result.output).toContain('</T>');
    expect(result.output).toContain('Welcome to our app');
    expect(result.wrappedCount).toBeGreaterThan(0);
  });

  it('wraps attribute values with t()', () => {
    const code = `function App() {
  return <input placeholder="Enter your name" />;
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    expect(result.output).toContain('placeholder={t("Enter your name")}');
    expect(result.wrappedCount).toBeGreaterThan(0);
  });

  it('adds import for T when wrapping JSX text', () => {
    const code = `function App() {
  return <h1>Welcome to our app</h1>;
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    expect(result.output).toContain('import { T } from "@vocoder/react"');
  });

  it('adds useVocoder import when wrapping attributes', () => {
    const code = `function App() {
  return <input placeholder="Enter your name" />;
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    expect(result.output).toContain('useVocoder');
  });

  it('adds useVocoder hook to component body', () => {
    const code = `function App() {
  return <input placeholder="Enter your name" />;
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    // Recast may format the destructuring across lines
    expect(result.output).toContain('useVocoder()');
    expect(result.output).toMatch(/const\s*\{[\s\S]*?t[\s\S]*?\}\s*=\s*useVocoder\(\)/);
  });

  it('appends to existing @vocoder/react import', () => {
    const code = `import { T } from '@vocoder/react';
function App() {
  return <input placeholder="Enter your name" />;
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    // Should add useVocoder to existing import, not create a second one
    const importCount = (result.output.match(/@vocoder\/react/g) || []).length;
    expect(importCount).toBe(1);
  });

  it('handles mixed JSX text and attributes', () => {
    const code = `function App() {
  return (
    <div>
      <h1>Welcome</h1>
      <input placeholder="Search" />
    </div>
  );
}`;
    const candidates = analyzer.analyzeCode(code);
    const result = transformer.transform(code, candidates);

    expect(result.output).toContain('<T>');
    expect(result.output).toContain('t("Search")');
    expect(result.wrappedCount).toBeGreaterThanOrEqual(2);
  });

  it('does not modify already-wrapped content', () => {
    const code = `import { T, useVocoder } from '@vocoder/react';
function App() {
  const { t } = useVocoder();
  return (
    <div>
      <T>Already wrapped</T>
      <input placeholder={t("Also wrapped")} />
    </div>
  );
}`;
    const candidates = analyzer.analyzeCode(code);
    expect(candidates.length).toBe(0);

    const result = transformer.transform(code, candidates);
    expect(result.wrappedCount).toBe(0);
    // Output should be essentially unchanged
    expect(result.output.trim()).toContain('Already wrapped');
  });

  it('reports skipped candidates that were not found in AST', () => {
    const code = `function App() {
  return <div>Hello</div>;
}`;
    // Create a fake candidate that won't match any AST node
    const fakeCandidates = [{
      file: '<input>',
      line: 999,
      column: 0,
      text: 'Not in file',
      confidence: 'high' as const,
      strategy: 'T-component' as const,
      context: 'jsx-text' as const,
      reason: 'test',
    }];

    const result = transformer.transform(code, fakeCandidates);
    expect(result.skipped.length).toBe(1);
    expect(result.wrappedCount).toBe(0);
  });
});
