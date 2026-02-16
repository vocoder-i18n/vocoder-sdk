const translations = {
  en: {
    'Hello': 'Hello',
    'Goodbye': 'Goodbye',
    'Hello, world!': 'Hello, world!',
    'Hello, {name}!': 'Hello, {name}!',
    'You have {count} messages': 'You have {count} messages',
    '{count, plural, =0 {No items} one {# item} other {# items}}':
      '{count, plural, =0 {No items} one {# item} other {# items}}',
    '{gender, select, male {He} female {She} other {They}} replied':
      '{gender, select, male {He} female {She} other {They}} replied',
    'Click <link>here</link> for help': 'Click <link>here</link> for help',
    'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>':
      'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>',
  },
  es: {
    'Hello': 'Hola',
    'Goodbye': 'Adios',
    'Hello, world!': 'Hola, mundo!',
    'Hello, {name}!': 'Hola, {name}!',
    'You have {count} messages': 'Tienes {count} mensajes',
    '{count, plural, =0 {No items} one {# item} other {# items}}':
      '{count, plural, =0 {Sin articulos} one {# articulo} other {# articulos}}',
    '{gender, select, male {He} female {She} other {They}} replied':
      '{gender, select, male {El} female {Ella} other {Elle}} respondio',
    'Click <link>here</link> for help': 'Haz clic <link>aqui</link> para obtener ayuda',
    'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>':
      'Lee nuestra <privacy>Politica de Privacidad</privacy> y <terms>Terminos de Servicio</terms>',
  },
  fr: {
    'Hello': 'Bonjour',
    'Goodbye': 'Au revoir',
    'Hello, world!': 'Bonjour, monde!',
    'Hello, {name}!': 'Bonjour, {name}!',
    'You have {count} messages': 'Vous avez {count} messages',
    '{count, plural, =0 {No items} one {# item} other {# items}}':
      '{count, plural, =0 {Aucun article} one {# article} other {# articles}}',
    '{gender, select, male {He} female {She} other {They}} replied':
      '{gender, select, male {Il} female {Elle} other {Iel}} a repondu',
    'Click <link>here</link> for help': 'Cliquez <link>ici</link> pour obtenir de l aide',
    'Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>':
      'Lisez notre <privacy>Politique de confidentialite</privacy> et nos <terms>Conditions d utilisation</terms>',
  },
} as const;

export const config = {
  sourceLocale: 'en',
  targetLocales: ['es', 'fr'],
  locales: {
    en: { nativeName: 'English' },
    es: { nativeName: 'Espanol' },
    fr: { nativeName: 'Francais' },
  },
};

export const loaders = {
  en: () => Promise.resolve({ default: translations.en }),
  es: () => Promise.resolve({ default: translations.es }),
  fr: () => Promise.resolve({ default: translations.fr }),
};

export default { config, loaders };
