// Source of truth: packages/react/src/types.ts + packages/react/src/T.tsx
// Update this constant when those files change.

export const SDK_REFERENCE = JSON.stringify(
	{
		import: "import { T, t, useVocoder, VocoderProvider } from '@vocoder/react'",

		TComponent: {
			description:
				"Wrap any translatable JSX text. The build plugin extracts <T> usage at compile time. Use for all visible UI strings.",
			props: {
				children:
					"ReactNode — source text / fallback content. Shown while translations load.",
				message:
					"string — ICU message template. Used as lookup key. Required when using interpolation or rich text via props.",
				id: "string — optional stable key. Overrides message-hash lookup. Use when you rename text but want to keep old translations.",
				values:
					"Record<string, any> — variable interpolation. e.g. values={{ name: user.name }}",
				value:
					"string | number | Date — drives plural/select/ordinal/format mode.",
				one: "string — CLDR plural: singular. Use # as number placeholder.",
				two: "string — CLDR plural: dual (Arabic, Hebrew, etc.).",
				few: "string — CLDR plural: a few.",
				many: "string — CLDR plural: many.",
				other: "string — CLDR plural: default/fallback category. Required for plurals.",
				"_word":
					"string — select case. _male, _female, _nonbinary, etc. Used with string value prop.",
				"_0 / _1 / _2":
					"string — exact numeric matches in plural mode (=0, =1, =2).",
				ordinal:
					"boolean — switch plural to ordinal mode (1st, 2nd, 3rd). Use with one/two/few/other.",
				gender: "string — gendered ordinal for Arabic/Hebrew. 'masculine' | 'feminine'.",
				format:
					"'number' | 'integer' | 'percent' | 'compact' | 'currency' | 'date' | 'time' | 'datetime' — pure locale formatting, bypasses translation lookup.",
				currency: "string — ISO 4217 code. Required when format='currency'.",
				dateStyle: "'full' | 'long' | 'medium' | 'short' — for format='date'/'datetime'.",
				timeStyle: "'full' | 'long' | 'medium' | 'short' — for format='time'/'datetime'.",
				context:
					"string — disambiguation when same text has different meanings in different UI contexts.",
				formality:
					"'formal' | 'informal' | 'auto' — translation formality level.",
				components:
					"ComponentSlot[] | Record<number, ComponentSlot> — rich text inline elements. Each slot maps to a numeric <0>, <1> placeholder. A slot is either a ReactElement (children injected via cloneElement) or a render function (children: ReactNode) => ReactNode. Plugin injects automatically for natural JSX syntax.",
			},
		},

		tFunction: {
			signature: "t(text: string, values?: Record<string, any>, options?: TOptions): string",
			description:
				"Global translate function. Returns a string — use in non-JSX contexts: toast messages, aria-labels, title attrs, console output, etc. Unlike useVocoder().t, this is NOT reactive — it reads locale at call time.",
			options: {
				context: "string — disambiguation context",
				formality: "'formal' | 'informal' | 'auto'",
				id: "string — stable key override",
			},
			examples: [
				"t('Save changes')",
				"t('Hello, {name}!', { name: user.name })",
				"t('Item added', {}, { context: 'cart-notification' })",
			],
		},

		useVocoderHook: {
			description:
				"React hook for reading locale state and switching locales. Use useVocoder().t for reactive translations inside components.",
			returns: {
				locale: "string — active BCP 47 locale code",
				setLocale: "(locale: string) => Promise<void> — switch locale",
				availableLocales: "string[] — all configured locales",
				isReady: "boolean — true when translations are loaded",
				dir: "'ltr' | 'rtl' — text direction for current locale",
				t: "(text, values?, options?) => string — reactive translate",
				hasTranslation: "(text: string) => boolean",
				getDisplayName: "(locale: string, viewingLocale?: string) => string",
				ordinal: "(value: number, gender?: string) => string",
				locales: "LocalesMap | undefined — locale metadata",
			},
		},

		VocoderProvider: {
			description:
				"Required context provider. Place at the root of your app. Reads sourceLocale and translations from the virtual module injected by @vocoder/plugin.",
			props: {
				children: "ReactNode — required",
				cookies:
					"string — SSR locale detection. Pass cookies from request headers. Next.js App Router: (await cookies()).toString(). Next.js Pages: req.headers.cookie.",
				applyDir:
					"boolean — auto-apply dir/lang attrs to <html>. Default true. Set false only if you manage direction yourself.",
			},
			ssrNote:
				"In Next.js App Router, VocoderProvider must run in a Client Component. Create a separate providers.tsx with 'use client'. Pass cookies from the Server Component layout.",
		},

		examples: {
			basicWrap: "<T>Hello, world!</T>",
			interpolation:
				"<T message=\"Welcome back, {name}!\" values={{ name: user.name }} />",
			plural:
				'<T value={count} one="# item in cart" other="# items in cart" />',
			select:
				'<T value={gender} _male="He accepted" _female="She accepted" other="They accepted" />',
			ordinal: '<T value={rank} ordinal one="#st" two="#nd" few="#rd" other="#th" />',
			richText:
				"<T>Read <a href=\"/docs\">the docs</a> for more.</T>",
			richTextExplicit:
				'<T message="Read <0>the docs</0> for more." components={[<a href="/docs" />]} />',
			tFunction: "t('Delete {count} files?', { count })",
			currency: '<T value={price} format="currency" currency="USD" />',
			dateFormat: '<T value={new Date()} format="date" dateStyle="long" />',
			contextual:
				'<T context="nav-tooltip">Home</T>  // same word, different context from hero <T>Home</T>',
			switchLocale:
				'const { setLocale } = useVocoder(); await setLocale("es");',
		},

		buildPlugin: {
			nextjs:
				"// next.config.ts\nimport { withVocoder } from '@vocoder/plugin/next';\nexport default withVocoder({ /* next config */ });",
			vite: "// vite.config.ts\nimport vocoder from '@vocoder/plugin/vite';\nexport default defineConfig({ plugins: [vocoder()] });",
		},

		configFile: {
			path: "vocoder.config.ts",
			example:
				"import { defineConfig } from '@vocoder/config';\nexport default defineConfig({ localesPath: 'src/locales' });",
		},
	},
	null,
	2,
);
