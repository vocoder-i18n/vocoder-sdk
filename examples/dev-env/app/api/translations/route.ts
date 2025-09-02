import { NextRequest, NextResponse } from 'next/server';

// Mock translations for testing
const MOCK_TRANSLATIONS = {
  en: {
    welcome_message: "Welcome {name}! It's great to see you again.",
    description: "This is a sample application using the Vocoder SDK.",
    button_text: "Click me",
    loading_text: "Loading translations...",
    error_text: "Failed to load translations",
    locale_info: "Current locale: {locale}",
    available_locales: "Available locales: {locales}",
    storage_test: "Storage test: {value}",
    api_key_test: "API key source: {source}"
  },
  fr: {
    welcome_message: "Bienvenue {name}! C'est un plaisir de vous revoir.",
    description: "Ceci est un exemple d'application utilisant le SDK Vocoder.",
    button_text: "Cliquez-moi",
    loading_text: "Chargement des traductions...",
    error_text: "Échec du chargement des traductions",
    locale_info: "Locale actuelle: {locale}",
    available_locales: "Locales disponibles: {locales}",
    storage_test: "Test de stockage: {value}",
    api_key_test: "Source de la clé API: {source}"
  },
  es: {
    welcome_message: "¡Bienvenido {name}! Es un placer verte de nuevo.",
    description: "Esta es una aplicación de ejemplo usando el SDK Vocoder.",
    button_text: "Haz clic en mí",
    loading_text: "Cargando traducciones...",
    error_text: "Error al cargar traducciones",
    locale_info: "Locale actual: {locale}",
    available_locales: "Locales disponibles: {locales}",
    storage_test: "Prueba de almacenamiento: {value}",
    api_key_test: "Fuente de la clave API: {source}"
  }
};

export async function GET(request: NextRequest) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Get API key from environment (server-side)
  const apiKey = process.env.VOCODER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing VOCODER_API_KEY environment variable' },
      { status: 400 }
    );
  }

  // In a real implementation, you would fetch from your API here
  // const response = await fetch('https://api.pierogi.dev/translations', {
  //   headers: {
  //     'Authorization': `Bearer ${apiKey}`,
  //     'Content-Type': 'application/json'
  //   }
  // });
  // const translations = await response.json();

  // For testing, return mock data
  return NextResponse.json(MOCK_TRANSLATIONS);
} 