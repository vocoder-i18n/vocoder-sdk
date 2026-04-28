import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { checkForUpdates, isRefreshAvailable } from "./api-runtime";
import {
	getConfig,
	getLocales,
	getTranslations,
	initializeVocoder,
	loadLocale,
	loadLocaleSync,
} from "./runtime";
import {
	_setGlobalLocale,
	_setGlobalTranslations,
	_setSourceLocale,
} from "./translate";
import type {
	LocalesMap,
	TranslationsMap,
	VocoderContextValue,
	VocoderProviderProps,
} from "./types";
import { getBestMatchingLocale, getCookie, setCookie } from "./utils/cookies";

const VocoderContext = createContext<VocoderContextValue | null>(null);

const STORAGE_KEY = "vocoder_locale";
const HYDRATION_ID = "__vocoder_hydration__";

type HydrationSnapshot = {
	locale: string;
	translations: Record<string, string>;
	locales: LocalesMap;
	defaultLocale: string;
};

function escapeJsonForHtml(value: string): string {
	return value.replace(/</g, "\\u003c");
}

function readHydrationFromDom(): {
	raw: string;
	data: HydrationSnapshot;
} | null {
	if (typeof document === "undefined") return null;
	const el = document.getElementById(HYDRATION_ID);
	const raw = el?.textContent || "";
	if (!raw) return null;
	try {
		const data = JSON.parse(raw) as HydrationSnapshot;
		if (!data || !data.locale || !data.translations) return null;
		return { raw, data };
	} catch {
		return null;
	}
}

function buildHydrationOnServer(
	cookieString: string | undefined,
): { raw: string; data: HydrationSnapshot } | null {
	if (typeof window !== "undefined") return null;

	const config = getConfig();
	const locales = getLocales() ?? {};
	const availableLocales = Object.keys(locales);
	const fallback = config.sourceLocale || availableLocales[0] || "en";

	const storedPreference = getCookie(STORAGE_KEY, cookieString);
	const bestLocale = storedPreference
		? availableLocales.length > 0
			? getBestMatchingLocale(storedPreference, availableLocales, fallback)
			: storedPreference
		: availableLocales.length > 0
			? getBestMatchingLocale(fallback, availableLocales, fallback)
			: fallback;

	const generated = getTranslations();
	let translations = generated[bestLocale];
	if (!translations) {
		const loaded = loadLocaleSync(bestLocale);
		if (loaded) translations = loaded;
	}

	const data: HydrationSnapshot = {
		locale: bestLocale,
		translations: translations || {},
		locales,
		defaultLocale: fallback,
	};

	const raw = escapeJsonForHtml(JSON.stringify(data));
	return { raw, data };
}

/** Provides locale state and translations from generated runtime data. */
export const VocoderProvider: React.FC<VocoderProviderProps> = ({
	children,
	cookies: cookieString,
	applyDir = true,
}) => {
	// ── Hydration (computed once, never changes) ─────────────────────
	const [hydration] = useState(() => {
		if (typeof window !== "undefined") {
			return readHydrationFromDom();
		}
		return buildHydrationOnServer(cookieString);
	});
	const hydrationData = hydration?.data;
	const hydrationRaw = hydration?.raw;

	// ── Core state ───────────────────────────────────────────────────
	const [translations, setTranslations] = useState<TranslationsMap>(() => {
		let initial: TranslationsMap;

		if (hydrationData?.translations && hydrationData?.locale) {
			initial = { [hydrationData.locale]: hydrationData.translations };
		} else {
			initial = { ...getTranslations() };
			const storedPreference = getCookie(STORAGE_KEY, cookieString);
			if (storedPreference && !initial[storedPreference]) {
				const loaded = loadLocaleSync(storedPreference);
				if (loaded) {
					initial[storedPreference] = loaded;
				}
			}
		}

		_setGlobalTranslations(initial);
		return initial;
	});

	const [locales, setLocales] = useState<LocalesMap>(
		() => hydrationData?.locales ?? getLocales(),
	);

	const [defaultLocale, setDefaultLocale] = useState(() => {
		const src =
			hydrationData?.defaultLocale || getConfig().sourceLocale || "en";
		_setSourceLocale(src);
		return src;
	});

	const [locale, setLocaleState] = useState<string>(() => {
		if (hydrationData?.locale) {
			_setGlobalLocale(hydrationData.locale);
			return hydrationData.locale;
		}

		const available =
			Object.keys(locales).length > 0
				? Object.keys(locales)
				: Object.keys(translations);

		const storedPreference = getCookie(STORAGE_KEY, cookieString);
		const preferred = storedPreference || defaultLocale;
		const best =
			available.length > 0
				? getBestMatchingLocale(preferred, available, defaultLocale)
				: defaultLocale;

		_setGlobalLocale(best);
		return best;
	});

	const [isInitialized, setIsInitialized] = useState(false);

	// ── Async initialization (client-side) ───────────────────────────
	useEffect(() => {
		if (isInitialized) return;

		let cancelled = false;

		(async () => {
			await initializeVocoder();
			if (cancelled) return;

			const cfg = getConfig();
			const genTranslations = getTranslations();
			const genLocales = getLocales();

			if (Object.keys(genTranslations).length > 0) {
				setTranslations((prev) => ({ ...genTranslations, ...prev }));
			}
			if (Object.keys(genLocales).length > 0) {
				setLocales(genLocales);
			}
			if (cfg.sourceLocale) {
				setDefaultLocale(cfg.sourceLocale);
			}

			const available =
				Object.keys(genLocales).length > 0
					? Object.keys(genLocales)
					: Object.keys(genTranslations);

			if (available.length > 0) {
				const fallback = cfg.sourceLocale || available[0] || "en";
				const storedPreference = getCookie(STORAGE_KEY, cookieString);
				const bestLocale = getBestMatchingLocale(
					storedPreference || fallback,
					available,
					fallback,
				);

				if (!genTranslations[bestLocale]) {
					const loaded = await loadLocale(bestLocale);
					if (cancelled) return;
					setTranslations((prev) => ({ ...prev, [bestLocale]: loaded }));
				}

				if (cancelled) return;
				setLocaleState(bestLocale);
				_setGlobalLocale(bestLocale);
			}

			setIsInitialized(true);
		})();

		return () => {
			cancelled = true;
		};
	}, [cookieString, hydrationData, isInitialized]);

	// ── Sync global state for t() function ───────────────────────────
	useEffect(() => {
		_setGlobalLocale(locale);
		_setGlobalTranslations(translations);
	}, [locale, translations]);

	// ── Apply dir/lang to document.documentElement (opt-in) ──────────
	useEffect(() => {
		if (!applyDir || typeof document === "undefined") return;
		const dir = locales?.[locale]?.dir ?? "ltr";
		document.documentElement.dir = dir;
		document.documentElement.lang = locale;
	}, [applyDir, locale, locales]);

	// ── Background refresh ───────────────────────────────────────────
	useEffect(() => {
		if (!isRefreshAvailable || !isInitialized || !locale) return;

		let cancelled = false;
		checkForUpdates(locale).then((updated) => {
			if (cancelled || !updated) return;
			setTranslations((prev) => ({ ...prev, [locale]: updated }));
		});

		return () => {
			cancelled = true;
		};
	}, [locale, isInitialized]);

	// ── Derived values ───────────────────────────────────────────────
	const isReady =
		Boolean(translations[locale]) && (isInitialized || Boolean(hydrationData));

	const availableLocales = useMemo(
		() =>
			Object.keys(locales).length > 0
				? Object.keys(locales)
				: Object.keys(translations),
		[locales, translations],
	);

	// ── Context methods ──────────────────────────────────────────────
	const t = useCallback(
		(text: string): string => translations[locale]?.[text] || text,
		[locale, translations],
	);

	const hasTranslation = useCallback(
		(text: string): boolean => {
			const localeTranslations = translations[locale];
			return Boolean(
				localeTranslations && Object.hasOwn(localeTranslations, text),
			);
		},
		[translations, locale],
	);

	const getDisplayName = useCallback(
		(targetLocale: string, viewingLocale?: string): string => {
			const vl = viewingLocale ?? locale;
			try {
				const dn = new Intl.DisplayNames([vl], { type: "language" });
				return dn.of(targetLocale) ?? targetLocale;
			} catch {
				return targetLocale;
			}
		},
		[locale],
	);

	const setLocale = useCallback(
		async (newLocale: string) => {
			const best = getBestMatchingLocale(
				newLocale,
				availableLocales,
				defaultLocale,
			);

			if (!translations[best]) {
				try {
					const loaded = await loadLocale(best);
					setTranslations((prev) => ({ ...prev, [best]: loaded }));
				} catch (error) {
					console.error(`Failed to load locale ${best}:`, error);
				}
			}

			setLocaleState(best);
			setCookie(STORAGE_KEY, best, {
				maxAge: 365 * 24 * 60 * 60,
				path: "/",
				sameSite: "Lax",
			});
			_setGlobalLocale(best);
		},
		[availableLocales, defaultLocale, translations],
	);

	// ── Render ───────────────────────────────────────────────────────
	const value: VocoderContextValue = {
		availableLocales,
		getDisplayName,
		isReady,
		locale,
		dir: (locales?.[locale]?.dir ?? "ltr") as "ltr" | "rtl",
		locales,
		setLocale,
		t,
		hasTranslation,
	};

	return (
		<VocoderContext.Provider value={value}>
			{hydrationRaw ? (
				<script
					id={HYDRATION_ID}
					type="application/json"
					suppressHydrationWarning
					dangerouslySetInnerHTML={{ __html: hydrationRaw }}
				/>
			) : null}
			{children}
		</VocoderContext.Provider>
	);
};

export const useVocoder = () => {
	const context = useContext(VocoderContext);
	if (!context) {
		throw new Error("useVocoder must be used inside VocoderProvider");
	}
	return context;
};
