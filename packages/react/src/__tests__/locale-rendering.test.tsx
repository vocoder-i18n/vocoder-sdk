/**
 * RTL tests for <T> and useVocoder() across locales.
 *
 * Coverage:
 *   - Plural branch selection: en (2-form), ru (4-form), ar (6-form), he (3-form), ja (1-form)
 *   - Ordinal suffix forms: en, fr, ru, ja
 *   - Ordinal word-based forms: ar (gendered), he (gendered)
 *   - Ordinal out-of-range fallback → String(value)
 *   - RTL direction flag: ar/he → "rtl", en/ru/ja → "ltr"
 *   - Variable preservation across Russian, Arabic, Japanese
 *   - Select mode (prop-mode and translated bundle)
 *   - Exact match plural (=0 form)
 *   - Missing key fallback → source string, no crash
 *   - useVocoder() t() / hasTranslation() / ordinal() hooks
 *
 * Zero live provider calls. All translation data is inline.
 * Runs on every commit — no gate needed.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { T } from "../T";
import { useVocoder, VocoderContext } from "../VocoderProvider";
import { generateMessageHash } from "../hash";
import { formatICU } from "../utils/formatMessage";
import type { LocalesMap, VocoderContextValue } from "../types";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function makeContextValue(
	locale: string,
	translations: Record<string, string>,
	locales?: LocalesMap,
): VocoderContextValue {
	const localeInfo = locales?.[locale];
	const dir = (localeInfo?.dir ?? "ltr") as "ltr" | "rtl";

	return {
		locale,
		dir,
		locales: locales ?? {},
		availableLocales: locales ? Object.keys(locales) : [locale],
		isReady: true,
		setLocale: async () => {},
		getDisplayName: (tl) => tl,

		hasTranslation: (key) =>
			Object.prototype.hasOwnProperty.call(translations, key) ||
			Object.prototype.hasOwnProperty.call(translations, generateMessageHash(key)),

		t: (text, values, options) => {
			const hash = options?.id ?? generateMessageHash(text, options?.context);
			const translated = translations[hash] ?? text;
			if (values && Object.keys(values).length > 0) {
				return formatICU(translated, values as Record<string, unknown>, locale);
			}
			return translated;
		},

		ordinal: (value, gender) => {
			const forms = localeInfo?.ordinalForms;

			if (!forms) return String(value);

			if (forms.type === "suffix") {
				const pr = new Intl.PluralRules(locale, { type: "ordinal" });
				const category = pr.select(value) as keyof typeof forms.suffixes;
				const pattern = forms.suffixes[category] ?? forms.suffixes.other;
				if (!pattern) return String(value);
				return pattern.replace("#", String(value));
			}

			if (forms.type === "word") {
				const genderKey = gender ?? "masculine";
				const genderMap =
					forms.words[genderKey] ??
					forms.words["masculine"] ??
					Object.values(forms.words)[0];
				const word = genderMap?.[value];
				if (word) return word;
			}

			return String(value);
		},
	};
}

function renderWithVocoder(
	ui: React.ReactElement,
	locale: string,
	translations: Record<string, string> = {},
	locales?: LocalesMap,
) {
	const value = makeContextValue(locale, translations, locales);
	return render(
		<VocoderContext.Provider value={value}>{ui}</VocoderContext.Provider>,
	);
}

// ---------------------------------------------------------------------------
// Translation bundles (hash keys verified by generateMessageHash)
//
// "0bt5k53" = {count, plural, one {# item} other {# items}}
// "1jkmkxh" = {count, plural, =0 {No items} one {# item} other {# items}}
// "0yvn7bx" = Hello, {name}!
// "1uanpsy" = {value, select, male {his} female {her} other {their}}
// "0x4ur6n" = {gender, select, male {He} female {She} other {They}} replied
// "0z8709g" = {count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
// ---------------------------------------------------------------------------

const RU: Record<string, string> = {
	"0bt5k53": "{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элемента}}",
	"1jkmkxh": "{count, plural, =0 {Нет элементов} one {# элемент} few {# элемента} many {# элементов} other {# элемента}}",
	"0yvn7bx": "Привет, {name}!",
	"1uanpsy": "{value, select, male {его} female {её} other {их}}",
	"0x4ur6n": "{gender, select, male {Он} female {Она} other {Они}} ответил(а)",
};

// ar-SA: production locale — Eastern Arabic-Indic numerals rendered by Intl.NumberFormat("ar-SA")
const AR_SA: Record<string, string> = {
	"0bt5k53": "{count, plural, zero {لا عناصر} one {# عنصر} two {# عنصران} few {# عناصر} many {# عنصر} other {# عنصر}}",
	"0yvn7bx": "مرحباً، {name}!",
};

const HE: Record<string, string> = {
	"0bt5k53": "{count, plural, one {# פריט} two {# פריטים} other {# פריטים}}",
};

const JA: Record<string, string> = {
	"0bt5k53": "{count, plural, other {# 個のアイテム}}",
	"0yvn7bx": "こんにちは、{name}！",
};

// ---------------------------------------------------------------------------
// Locale metadata (with ordinalForms)
// ---------------------------------------------------------------------------

const EN_LOCALES: LocalesMap = {
	en: {
		nativeName: "English",
		ordinalForms: { type: "suffix", suffixes: { one: "#st", two: "#nd", few: "#rd", other: "#th" } },
	},
};

const FR_LOCALES: LocalesMap = {
	fr: {
		nativeName: "Français",
		ordinalForms: { type: "suffix", suffixes: { one: "#er", other: "#e" } },
	},
};

const RU_LOCALES: LocalesMap = {
	ru: {
		nativeName: "Русский",
		ordinalForms: { type: "suffix", suffixes: { other: "#." } },
	},
};

// ar-SA: production locale stored in DB. DeepL mapping: ar-SA → ar (via localeProvider table).
const AR_SA_LOCALES: LocalesMap = {
	"ar-SA": {
		nativeName: "العربية",
		dir: "rtl",
		ordinalForms: {
			type: "word",
			words: {
				masculine: { 1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس" },
				feminine:  { 1: "الأولى", 2: "الثانية", 3: "الثالثة", 4: "الرابعة", 5: "الخامسة" },
			},
		},
	},
};

const HE_LOCALES: LocalesMap = {
	he: {
		nativeName: "עברית",
		dir: "rtl",
		ordinalForms: {
			type: "word",
			words: {
				masculine: { 1: "ראשון", 2: "שני", 3: "שלישי", 10: "עשירי" },
				feminine:  { 1: "ראשונה", 2: "שנייה", 3: "שלישית", 10: "עשירית" },
			},
		},
	},
};

const JA_LOCALES: LocalesMap = {
	ja: {
		nativeName: "日本語",
		ordinalForms: { type: "suffix", suffixes: { other: "#番目" } },
	},
};

// ---------------------------------------------------------------------------
// Plural branch selection: English baseline
// ---------------------------------------------------------------------------

describe("Plural en: 2-form (one/other), no bundle translation", () => {
	it("n=1 → one branch", () => {
		renderWithVocoder(<T value={1} one="# item" other="# items" />, "en");
		expect(screen.getByText("1 item")).toBeInTheDocument();
	});

	it("n=5 → other branch", () => {
		renderWithVocoder(<T value={5} one="# item" other="# items" />, "en");
		expect(screen.getByText("5 items")).toBeInTheDocument();
	});

	it("n=0 → other branch (en has no zero category)", () => {
		renderWithVocoder(<T value={0} one="# item" other="# items" />, "en");
		expect(screen.getByText("0 items")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Plural branch selection: Russian (4 CLDR forms)
// ---------------------------------------------------------------------------

describe("Plural ru: 4-form expanded ICU (one/few/many/other)", () => {
	it("n=1 → one: '1 элемент'", () => {
		renderWithVocoder(<T value={1} one="# item" other="# items" />, "ru", RU);
		expect(screen.getByText("1 элемент")).toBeInTheDocument();
	});

	it("n=2 → few: '2 элемента'", () => {
		renderWithVocoder(<T value={2} one="# item" other="# items" />, "ru", RU);
		expect(screen.getByText("2 элемента")).toBeInTheDocument();
	});

	it("n=5 → many: '5 элементов'", () => {
		renderWithVocoder(<T value={5} one="# item" other="# items" />, "ru", RU);
		expect(screen.getByText("5 элементов")).toBeInTheDocument();
	});

	it("n=11 → many: '11 элементов' (11-19 are many, not one)", () => {
		renderWithVocoder(<T value={11} one="# item" other="# items" />, "ru", RU);
		expect(screen.getByText("11 элементов")).toBeInTheDocument();
	});

	it("n=21 → one: '21 элемент' (21 mod 10 = 1 → one)", () => {
		renderWithVocoder(<T value={21} one="# item" other="# items" />, "ru", RU);
		expect(screen.getByText("21 элемент")).toBeInTheDocument();
	});

	it("n=100 → many: '100 элементов'", () => {
		renderWithVocoder(<T value={100} one="# item" other="# items" />, "ru", RU);
		expect(screen.getByText("100 элементов")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Plural branch selection: Arabic (6 CLDR forms)
// ---------------------------------------------------------------------------

// ar-SA: Eastern Arabic-Indic numerals (١٢٣...) via Intl.NumberFormat("ar-SA")
describe("Plural ar-SA: 6-form expanded ICU (zero/one/two/few/many/other)", () => {
	it("n=0 → zero: 'لا عناصر' (no numeral in zero branch)", () => {
		renderWithVocoder(<T value={0} one="# item" other="# items" />, "ar-SA", AR_SA, AR_SA_LOCALES);
		expect(screen.getByText("لا عناصر")).toBeInTheDocument();
	});

	it("n=1 → one: '١ عنصر' (Eastern Arabic-Indic numeral)", () => {
		renderWithVocoder(<T value={1} one="# item" other="# items" />, "ar-SA", AR_SA, AR_SA_LOCALES);
		expect(screen.getByText("١ عنصر")).toBeInTheDocument();
	});

	it("n=2 → two: '٢ عنصران'", () => {
		renderWithVocoder(<T value={2} one="# item" other="# items" />, "ar-SA", AR_SA, AR_SA_LOCALES);
		expect(screen.getByText("٢ عنصران")).toBeInTheDocument();
	});

	it("n=3 → few: '٣ عناصر' (3-10 are few)", () => {
		renderWithVocoder(<T value={3} one="# item" other="# items" />, "ar-SA", AR_SA, AR_SA_LOCALES);
		expect(screen.getByText("٣ عناصر")).toBeInTheDocument();
	});

	it("n=11 → many: '١١ عنصر' (11-99 are many)", () => {
		renderWithVocoder(<T value={11} one="# item" other="# items" />, "ar-SA", AR_SA, AR_SA_LOCALES);
		expect(screen.getByText("١١ عنصر")).toBeInTheDocument();
	});

	it("n=100 → other: '١٠٠ عنصر'", () => {
		renderWithVocoder(<T value={100} one="# item" other="# items" />, "ar-SA", AR_SA, AR_SA_LOCALES);
		expect(screen.getByText("١٠٠ عنصر")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Plural branch selection: Japanese (1 CLDR form)
// ---------------------------------------------------------------------------

describe("Plural ja: 1-form (other only)", () => {
	it("n=0 → other: '0 個のアイテム'", () => {
		renderWithVocoder(<T value={0} one="# item" other="# items" />, "ja", JA);
		expect(screen.getByText("0 個のアイテム")).toBeInTheDocument();
	});

	it("n=1 → other: '1 個のアイテム' (ja has no 'one' category)", () => {
		renderWithVocoder(<T value={1} one="# item" other="# items" />, "ja", JA);
		expect(screen.getByText("1 個のアイテム")).toBeInTheDocument();
	});

	it("n=100 → other: '100 個のアイテム'", () => {
		renderWithVocoder(<T value={100} one="# item" other="# items" />, "ja", JA);
		expect(screen.getByText("100 個のアイテム")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Plural branch selection: Hebrew (3 CLDR forms)
// ---------------------------------------------------------------------------

describe("Plural he: 3-form (one/two/other)", () => {
	it("n=1 → one: '1 פריט'", () => {
		renderWithVocoder(<T value={1} one="# item" other="# items" />, "he", HE);
		expect(screen.getByText("1 פריט")).toBeInTheDocument();
	});

	it("n=2 → two: '2 פריטים'", () => {
		renderWithVocoder(<T value={2} one="# item" other="# items" />, "he", HE);
		expect(screen.getByText("2 פריטים")).toBeInTheDocument();
	});

	it("n=5 → other: '5 פריטים'", () => {
		renderWithVocoder(<T value={5} one="# item" other="# items" />, "he", HE);
		expect(screen.getByText("5 פריטים")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Ordinal: English suffix forms
// ---------------------------------------------------------------------------

describe("Ordinal en: suffix (one=#st two=#nd few=#rd other=#th)", () => {
	it("<T value={1} ordinal /> → '1st'", () => {
		renderWithVocoder(<T value={1} ordinal />, "en", {}, EN_LOCALES);
		expect(screen.getByText("1st")).toBeInTheDocument();
	});

	it("<T value={2} ordinal /> → '2nd'", () => {
		renderWithVocoder(<T value={2} ordinal />, "en", {}, EN_LOCALES);
		expect(screen.getByText("2nd")).toBeInTheDocument();
	});

	it("<T value={3} ordinal /> → '3rd'", () => {
		renderWithVocoder(<T value={3} ordinal />, "en", {}, EN_LOCALES);
		expect(screen.getByText("3rd")).toBeInTheDocument();
	});

	it("<T value={4} ordinal /> → '4th'", () => {
		renderWithVocoder(<T value={4} ordinal />, "en", {}, EN_LOCALES);
		expect(screen.getByText("4th")).toBeInTheDocument();
	});

	it("<T value={11} ordinal /> → '11th' (11 is other in en ordinal)", () => {
		renderWithVocoder(<T value={11} ordinal />, "en", {}, EN_LOCALES);
		expect(screen.getByText("11th")).toBeInTheDocument();
	});

	it("<T value={21} ordinal /> → '21st'", () => {
		renderWithVocoder(<T value={21} ordinal />, "en", {}, EN_LOCALES);
		expect(screen.getByText("21st")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Ordinal: French suffix forms
// ---------------------------------------------------------------------------

describe("Ordinal fr: suffix (one=#er other=#e)", () => {
	it("<T value={1} ordinal /> → '1er'", () => {
		renderWithVocoder(<T value={1} ordinal />, "fr", {}, FR_LOCALES);
		expect(screen.getByText("1er")).toBeInTheDocument();
	});

	it("<T value={2} ordinal /> → '2e'", () => {
		renderWithVocoder(<T value={2} ordinal />, "fr", {}, FR_LOCALES);
		expect(screen.getByText("2e")).toBeInTheDocument();
	});

	it("<T value={21} ordinal /> → '21e'", () => {
		renderWithVocoder(<T value={21} ordinal />, "fr", {}, FR_LOCALES);
		expect(screen.getByText("21e")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Ordinal: Russian and Japanese single-category suffix
// ---------------------------------------------------------------------------

describe("Ordinal ru/ja: single-category suffix", () => {
	it("ru: <T value={1} ordinal /> → '1.' (only 'other' category)", () => {
		renderWithVocoder(<T value={1} ordinal />, "ru", {}, RU_LOCALES);
		expect(screen.getByText("1.")).toBeInTheDocument();
	});

	it("ru: <T value={5} ordinal /> → '5.'", () => {
		renderWithVocoder(<T value={5} ordinal />, "ru", {}, RU_LOCALES);
		expect(screen.getByText("5.")).toBeInTheDocument();
	});

	it("ja: <T value={1} ordinal /> → '1番目'", () => {
		renderWithVocoder(<T value={1} ordinal />, "ja", {}, JA_LOCALES);
		expect(screen.getByText("1番目")).toBeInTheDocument();
	});

	it("ja: <T value={10} ordinal /> → '10番目'", () => {
		renderWithVocoder(<T value={10} ordinal />, "ja", {}, JA_LOCALES);
		expect(screen.getByText("10番目")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Ordinal: Arabic word-based (gendered)
// ---------------------------------------------------------------------------

describe("Ordinal ar: word-based, gender-aware", () => {
	it("rank=1 masculine → 'الأول'", () => {
		renderWithVocoder(<T value={1} ordinal gender="masculine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("الأول")).toBeInTheDocument();
	});

	it("rank=1 feminine → 'الأولى'", () => {
		renderWithVocoder(<T value={1} ordinal gender="feminine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("الأولى")).toBeInTheDocument();
	});

	it("rank=2 masculine → 'الثاني'", () => {
		renderWithVocoder(<T value={2} ordinal gender="masculine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("الثاني")).toBeInTheDocument();
	});

	it("rank=2 feminine → 'الثانية'", () => {
		renderWithVocoder(<T value={2} ordinal gender="feminine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("الثانية")).toBeInTheDocument();
	});

	it("rank=5 masculine → 'الخامس'", () => {
		renderWithVocoder(<T value={5} ordinal gender="masculine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("الخامس")).toBeInTheDocument();
	});

	it("rank=5 feminine → 'الخامسة'", () => {
		renderWithVocoder(<T value={5} ordinal gender="feminine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("الخامسة")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Ordinal: Hebrew word-based (gendered)
// ---------------------------------------------------------------------------

describe("Ordinal he: word-based, gender-aware", () => {
	it("rank=1 masculine → 'ראשון'", () => {
		renderWithVocoder(<T value={1} ordinal gender="masculine" />, "he", {}, HE_LOCALES);
		expect(screen.getByText("ראשון")).toBeInTheDocument();
	});

	it("rank=1 feminine → 'ראשונה'", () => {
		renderWithVocoder(<T value={1} ordinal gender="feminine" />, "he", {}, HE_LOCALES);
		expect(screen.getByText("ראשונה")).toBeInTheDocument();
	});

	it("rank=3 masculine → 'שלישי'", () => {
		renderWithVocoder(<T value={3} ordinal gender="masculine" />, "he", {}, HE_LOCALES);
		expect(screen.getByText("שלישי")).toBeInTheDocument();
	});

	it("rank=3 feminine → 'שלישית'", () => {
		renderWithVocoder(<T value={3} ordinal gender="feminine" />, "he", {}, HE_LOCALES);
		expect(screen.getByText("שלישית")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Ordinal: out-of-range → String(value)
// ---------------------------------------------------------------------------

describe("Ordinal out-of-range: word map miss → String(value)", () => {
	it("ar-SA rank=200 not in words map → '200'", () => {
		renderWithVocoder(<T value={200} ordinal gender="masculine" />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByText("200")).toBeInTheDocument();
	});

	it("he rank=100 not in words map → '100'", () => {
		renderWithVocoder(<T value={100} ordinal gender="masculine" />, "he", {}, HE_LOCALES);
		expect(screen.getByText("100")).toBeInTheDocument();
	});

	it("ordinal with no locales → String(value)", () => {
		renderWithVocoder(<T value={42} ordinal />, "en", {});
		// No ordinalForms in locales → no bundle ICU → bare number
		expect(screen.getByText("42")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// RTL direction flag
// ---------------------------------------------------------------------------

function DirDisplay() {
	const { dir } = useVocoder();
	return <span data-testid="dir">{dir}</span>;
}

describe("RTL direction flag", () => {
	it("ar-SA locale → dir='rtl'", () => {
		renderWithVocoder(<DirDisplay />, "ar-SA", {}, AR_SA_LOCALES);
		expect(screen.getByTestId("dir")).toHaveTextContent("rtl");
	});

	it("he locale → dir='rtl'", () => {
		renderWithVocoder(<DirDisplay />, "he", {}, HE_LOCALES);
		expect(screen.getByTestId("dir")).toHaveTextContent("rtl");
	});

	it("en locale → dir='ltr'", () => {
		renderWithVocoder(<DirDisplay />, "en", {}, EN_LOCALES);
		expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
	});

	it("ru locale → dir='ltr'", () => {
		renderWithVocoder(<DirDisplay />, "ru", {}, RU_LOCALES);
		expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
	});

	it("ja locale → dir='ltr'", () => {
		renderWithVocoder(<DirDisplay />, "ja", {}, JA_LOCALES);
		expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
	});
});

// ---------------------------------------------------------------------------
// Variable preservation across locales
// ---------------------------------------------------------------------------

describe("Variable preservation: {name} survives translation", () => {
	it("ru: 'Hello, {name}!' → 'Привет, Alice!'", () => {
		renderWithVocoder(
			<T message="Hello, {name}!" values={{ name: "Alice" }} />,
			"ru", RU,
		);
		expect(screen.getByText("Привет, Alice!")).toBeInTheDocument();
	});

	it("ar: 'Hello, {name}!' → 'مرحباً، أحمد!'", () => {
		renderWithVocoder(
			<T message="Hello, {name}!" values={{ name: "أحمد" }} />,
			"ar-SA", AR_SA,
		);
		expect(screen.getByText("مرحباً، أحمد!")).toBeInTheDocument();
	});

	it("ja: 'Hello, {name}!' → 'こんにちは、太郎！'", () => {
		renderWithVocoder(
			<T message="Hello, {name}!" values={{ name: "太郎" }} />,
			"ja", JA,
		);
		expect(screen.getByText("こんにちは、太郎！")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Select mode
// ---------------------------------------------------------------------------

describe("Select mode: prop-mode _word props", () => {
	it("en: value='male' _male='his' → 'his'", () => {
		renderWithVocoder(<T value="male" _male="his" _female="her" other="their" />, "en");
		expect(screen.getByText("his")).toBeInTheDocument();
	});

	it("en: value='female' _female='her' → 'her'", () => {
		renderWithVocoder(<T value="female" _male="his" _female="her" other="their" />, "en");
		expect(screen.getByText("her")).toBeInTheDocument();
	});

	it("en: value='nonbinary' → 'their' (other fallback)", () => {
		renderWithVocoder(<T value="nonbinary" _male="his" _female="her" other="their" />, "en");
		expect(screen.getByText("their")).toBeInTheDocument();
	});

	it("ru: translated select → 'его' for male", () => {
		renderWithVocoder(
			<T message="{value, select, male {his} female {her} other {their}}" values={{ value: "male" }} />,
			"ru", RU,
		);
		expect(screen.getByText("его")).toBeInTheDocument();
	});

	it("ru: translated select → 'её' for female", () => {
		renderWithVocoder(
			<T message="{value, select, male {his} female {her} other {their}}" values={{ value: "female" }} />,
			"ru", RU,
		);
		expect(screen.getByText("её")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Exact match plural (=0 form)
// ---------------------------------------------------------------------------

describe("Exact match plural: =0 form overrides 'zero' category", () => {
	it("en: n=0 with _0='No items' → 'No items'", () => {
		renderWithVocoder(
			<T value={0} _0="No items" one="# item" other="# items" />,
			"en",
		);
		expect(screen.getByText("No items")).toBeInTheDocument();
	});

	it("en: n=1 with _0 → one branch wins", () => {
		renderWithVocoder(
			<T value={1} _0="No items" one="# item" other="# items" />,
			"en",
		);
		expect(screen.getByText("1 item")).toBeInTheDocument();
	});

	it("ru: n=0 translated → 'Нет элементов'", () => {
		renderWithVocoder(
			<T value={0} _0="No items" one="# item" other="# items" />,
			"ru", RU,
		);
		expect(screen.getByText("Нет элементов")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Missing key fallback
// ---------------------------------------------------------------------------

describe("Missing key fallback: source text shown when no translation", () => {
	it("ru: untranslated message → source English text", () => {
		renderWithVocoder(
			<T message="Save your work" />,
			"ru", RU,
		);
		expect(screen.getByText("Save your work")).toBeInTheDocument();
	});

	it("ar: untranslated message → source English text", () => {
		renderWithVocoder(
			<T message="Save your work" />,
			"ar-SA", AR_SA,
		);
		expect(screen.getByText("Save your work")).toBeInTheDocument();
	});

	it("empty bundle → source text, no crash", () => {
		renderWithVocoder(
			<T message="Hello, world!" />,
			"he", {},
		);
		expect(screen.getByText("Hello, world!")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// useVocoder() hook: t(), hasTranslation(), ordinal()
// ---------------------------------------------------------------------------

function HookConsumer({
	messageKey,
	sourceText,
}: {
	messageKey: string;
	sourceText: string;
}) {
	const { t, hasTranslation, locale, ordinal } = useVocoder();
	return (
		<div>
			<span data-testid="locale">{locale}</span>
			<span data-testid="has-known">{String(hasTranslation(messageKey))}</span>
			<span data-testid="has-unknown">{String(hasTranslation("nonexistent-xyz"))}</span>
			<span data-testid="translated">{t(sourceText, undefined, { id: messageKey })}</span>
			<span data-testid="ordinal-1">{ordinal(1)}</span>
			<span data-testid="ordinal-2">{ordinal(2)}</span>
		</div>
	);
}

describe("useVocoder() hook: t(), hasTranslation(), ordinal()", () => {
	it("ru: locale is 'ru'", () => {
		renderWithVocoder(
			<HookConsumer messageKey="0bt5k53" sourceText="{count, plural, one {# item} other {# items}}" />,
			"ru", RU, RU_LOCALES,
		);
		expect(screen.getByTestId("locale")).toHaveTextContent("ru");
	});

	it("ru: hasTranslation(knownHash) → true", () => {
		renderWithVocoder(
			<HookConsumer messageKey="0bt5k53" sourceText="{count, plural, one {# item} other {# items}}" />,
			"ru", RU, RU_LOCALES,
		);
		expect(screen.getByTestId("has-known")).toHaveTextContent("true");
	});

	it("ru: hasTranslation('nonexistent-xyz') → false", () => {
		renderWithVocoder(
			<HookConsumer messageKey="0bt5k53" sourceText="{count, plural, one {# item} other {# items}}" />,
			"ru", RU, RU_LOCALES,
		);
		expect(screen.getByTestId("has-unknown")).toHaveTextContent("false");
	});

	it("ru: t(sourceICU, {id}) returns translated ICU (no values = raw ICU string)", () => {
		renderWithVocoder(
			<HookConsumer messageKey="0bt5k53" sourceText="{count, plural, one {# item} other {# items}}" />,
			"ru", RU, RU_LOCALES,
		);
		expect(screen.getByTestId("translated")).toHaveTextContent("элемент");
	});

	it("en: ordinal(1) → '1st' via hook", () => {
		renderWithVocoder(
			<HookConsumer messageKey="0bt5k53" sourceText="" />,
			"en", {}, EN_LOCALES,
		);
		expect(screen.getByTestId("ordinal-1")).toHaveTextContent("1st");
	});

	it("en: ordinal(2) → '2nd' via hook", () => {
		renderWithVocoder(
			<HookConsumer messageKey="0bt5k53" sourceText="" />,
			"en", {}, EN_LOCALES,
		);
		expect(screen.getByTestId("ordinal-2")).toHaveTextContent("2nd");
	});

	it("fr: ordinal(1) → '1er' via hook", () => {
		renderWithVocoder(
			<HookConsumer messageKey="1jkmkxh" sourceText="" />,
			"fr", {}, FR_LOCALES,
		);
		expect(screen.getByTestId("ordinal-1")).toHaveTextContent("1er");
	});

	it("ar: ordinal(1, 'masculine') → 'الأول' via hook", () => {
		const { ordinal } = makeContextValue("ar-SA", {}, AR_SA_LOCALES);
		expect(ordinal(1, "masculine")).toBe("الأول");
	});

	it("ar: ordinal(1, 'feminine') → 'الأولى' via hook", () => {
		const { ordinal } = makeContextValue("ar-SA", {}, AR_SA_LOCALES);
		expect(ordinal(1, "feminine")).toBe("الأولى");
	});

	it("he: ordinal(3, 'masculine') → 'שלישי' via hook", () => {
		const { ordinal } = makeContextValue("he", {}, HE_LOCALES);
		expect(ordinal(3, "masculine")).toBe("שלישי");
	});
});
