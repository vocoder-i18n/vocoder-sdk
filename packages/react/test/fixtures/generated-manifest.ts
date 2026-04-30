// Keys are FNV-1a 32-bit hashes of the source text (generateMessageHash).
// Must match the hash function in src/hash.ts — update both together.
const translations = {
	en: {
		"1w2u0qz": "Hello",
		"0x5nje8": "Goodbye",
		"1twzd04": "Hello, world!",
		"0yvn7bx": "Hello, {name}!",
		"0qy12rf": "You have {count} messages",
		"0bt5k53": "{count, plural, one {# item} other {# items}}",
		"1jkmkxh": "{count, plural, =0 {No items} one {# item} other {# items}}",
		"0z8709g": "{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}",
		"1uanpsy": "{value, select, male {his} female {her} other {their}}",
		"0x4ur6n": "{gender, select, male {He} female {She} other {They}} replied",
		"1mx4siq": "Click <c0>here</c0> for help",
		"0ydwi6n": "Read our <c0>Privacy Policy</c0> and <c1>Terms of Service</c1>",
	},
	es: {
		"1w2u0qz": "Hola",
		"0x5nje8": "Adios",
		"1twzd04": "Hola, mundo!",
		"0yvn7bx": "Hola, {name}!",
		"0qy12rf": "Tienes {count} mensajes",
		"0bt5k53": "{count, plural, one {# articulo} other {# articulos}}",
		"1jkmkxh": "{count, plural, =0 {Sin articulos} one {# articulo} other {# articulos}}",
		"0z8709g": "{count, selectordinal, one {#er} two {#do} few {#er} other {#to}}",
		"1uanpsy": "{value, select, male {su} female {su} other {su}}",
		"0x4ur6n": "{gender, select, male {El} female {Ella} other {Elle}} respondio",
		"1mx4siq": "Haz clic <c0>aqui</c0> para obtener ayuda",
		"0ydwi6n": "Lee nuestra <c0>Politica de Privacidad</c0> y <c1>Terminos de Servicio</c1>",
	},
	fr: {
		"1w2u0qz": "Bonjour",
		"0x5nje8": "Au revoir",
		"1twzd04": "Bonjour, monde!",
		"0yvn7bx": "Bonjour, {name}!",
		"0qy12rf": "Vous avez {count} messages",
		"1jkmkxh": "{count, plural, =0 {Aucun article} one {# article} other {# articles}}",
		"0x4ur6n": "{gender, select, male {Il} female {Elle} other {Iel}} a repondu",
		"1mx4siq": "Cliquez <c0>ici</c0> pour obtenir de l aide",
		"0ydwi6n": "Lisez notre <c0>Politique de confidentialite</c0> et nos <c1>Conditions d utilisation</c1>",
	},
} as const;

export const config = {
	sourceLocale: "en",
	targetLocales: ["es", "fr"],
	locales: {
		en: { nativeName: "English" },
		es: { nativeName: "Espanol" },
		fr: { nativeName: "Francais" },
	},
};

export const loaders = {
	en: () => Promise.resolve({ default: translations.en }),
	es: () => Promise.resolve({ default: translations.es }),
	fr: () => Promise.resolve({ default: translations.fr }),
};

export default { config, loaders };
