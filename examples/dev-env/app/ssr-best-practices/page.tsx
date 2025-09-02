import { Translation, TranslationProviderServer } from '@vocoder/react';

import ClientInteractiveSection from './ClientInteractiveSection';

// Mock translations
const TRANSLATIONS = {
  en: {
    page_title: "SSR Best Practices",
    server_section: "This content is server-rendered",
    client_section: "This section is client-side interactive",
    static_content: "Static content that doesn't need interactivity"
  },
  fr: {
    page_title: "Meilleures pratiques SSR",
    server_section: "Ce contenu est rendu côté serveur",
    client_section: "Cette section est interactive côté client",
    static_content: "Contenu statique qui n'a pas besoin d'interactivité"
  }
};

// This is a Server Component (no "use client" directive)
export default function SSRBestPracticesPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>SSR Best Practices Example</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h2>Server Component (This Page)</h2>
        <p>This entire page is a Server Component. It can:</p>
        <ul>
          <li>✅ Fetch data on the server</li>
          <li>✅ Access environment variables securely</li>
          <li>✅ Render static content</li>
          <li>❌ Use React hooks (useState, useEffect, etc.)</li>
          <li>❌ Handle user interactions</li>
        </ul>
      </div>

      {/* Server-rendered static content */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #4caf50', borderRadius: '8px' }}>
        <h3>Server-Rendered Static Content</h3>
        <p>This content is rendered on the server and doesn't need interactivity.</p>
        
        <TranslationProviderServer 
          translations={TRANSLATIONS}
          locale="en"
        >
          <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <Translation 
              id="static_content" 
              text="Static content that doesn't need interactivity" 
            />
          </div>
        </TranslationProviderServer>
      </div>

      {/* Client component for interactive features */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #ff9800', borderRadius: '8px' }}>
        <h3>Client Component (Interactive)</h3>
        <p>This section is a Client Component that handles user interactions.</p>
        
        <ClientInteractiveSection translations={TRANSLATIONS} />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Best Practices Summary</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4>Server Components</h4>
            <ul>
              <li>Static content rendering</li>
              <li>Data fetching</li>
              <li>SEO optimization</li>
              <li>Security (API keys, etc.)</li>
              <li>Performance (smaller JS bundles)</li>
            </ul>
          </div>
          
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4>Client Components</h4>
            <ul>
              <li>User interactions</li>
              <li>State management</li>
              <li>Event handlers</li>
              <li>Browser APIs</li>
              <li>Real-time updates</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>When to Use Each Approach</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <h4>Use Server Components for:</h4>
          <ul>
            <li><strong>Static pages</strong> - About pages, documentation, etc.</li>
            <li><strong>SEO-critical content</strong> - Product listings, blog posts</li>
            <li><strong>Data fetching</strong> - Database queries, API calls with secrets</li>
            <li><strong>Performance</strong> - Reduce JavaScript bundle size</li>
          </ul>
        </div>
        
        <div>
          <h4>Use Client Components for:</h4>
          <ul>
            <li><strong>Interactive features</strong> - Forms, buttons, dropdowns</li>
            <li><strong>State management</strong> - User preferences, form data</li>
            <li><strong>Real-time updates</strong> - WebSockets, live data</li>
            <li><strong>Browser APIs</strong> - localStorage, geolocation, etc.</li>
          </ul>
        </div>
      </div>

      <div>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Back to Main Test Page
        </a>
      </div>
    </div>
  );
} 