import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React from "react";
import type { LocaleSelectorProps } from "./types";
import { useVocoder } from "./VocoderProvider";

const POSITION_MAP: Record<string, string> = {
	tl: "top-left",
	tr: "top-right",
	bl: "bottom-left",
	br: "bottom-right",
};

const LOGO_FILL_LIGHT = "#151515";
const LOGO_FILL_DARK = "#EFEAE3";

const TRIGGER_ATTR = "data-vocoder-trigger";
const FOCUS_STYLE = `[${TRIGGER_ATTR}]{outline:none;}[${TRIGGER_ATTR}]:focus-visible{outline:2px solid #4f8ef7;outline-offset:0;}`;

const VocoderLogo = ({ fill, size }: { fill: string; size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 136 136"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M84 20C101.673 20.0004 116 34.3272 116 52L116.004 60C116.004 77.6719 101.676 91.9985 84.0039 92H69.4219L40.0039 116V89.6641C28.2816 84.9171 20.0045 73.4323 20.0039 60L20 52C20.0005 34.3273 34.3273 20.0001 52 20H84ZM48 83.8555L48.0039 83.8594V99.0938L58.6914 90.4062C54.6099 88.9674 50.9658 86.6107 48 83.582V83.8555ZM96 64C95.9999 71.6713 92.9113 78.6186 87.9141 83.6758C99.3023 81.8079 107.992 71.9304 108 60.0156H96V64ZM48 64C48.0004 73.6752 54.8716 81.7444 64 83.5977V60.0078L48 60.0039V64ZM72 83.5977C81.1286 81.7444 87.9999 73.6754 88 64V60.0117L72 60.0078V83.5977ZM28.0039 60C28.0043 68.8776 32.827 76.6334 40 80.7852V60H28.0039ZM87.918 28.3242C92.9139 33.3813 96.0001 40.3297 96 48V52.0156H108V52C108 40.0801 99.3084 30.1954 87.918 28.3242ZM72 52.0078L88 52.0117V48C88.0001 38.3241 81.1291 30.2514 72 28.3984V52.0078ZM64 28.3984C54.8712 30.2516 48.0001 38.3245 48 48V52.0039L64 52.0078V28.3984ZM48.082 28.3203C37.0868 30.1261 28.607 39.4023 28.0312 50.7656L28 52H40V48C40.0001 40.329 43.085 33.3776 48.082 28.3203Z"
			fill={fill}
		/>
	</svg>
);

/**
 * LocaleSelector component provides a Vocoder-branded button with dropdown for switching languages.
 *
 * Features:
 * - Vocoder logomark button that opens a language selector
 * - Auto light/dark mode: detects `.dark`/`.light` CSS class on `<html>` first (Tailwind, shadcn, etc.),
 *   then falls back to `prefers-color-scheme`. Override with the `mode` prop.
 * - Configurable position (top-left, top-right, bottom-left, bottom-right)
 * - Customizable colors via props (override auto mode)
 * - Smart positioning: opens below for top positions, above for bottom positions
 * - Supports shorthand position notation (tl, tr, bl, br)
 * - Displays locale names as native names only (e.g., "Español", "Deutsch", "العربية")
 * - Configurable sorting: by native names (default), English source names, or translated names
 *   (Intl.DisplayNames is used to resolve names for sorting, not for display)
 *
 * @example Auto theme (follows app theme or system preference)
 * ```tsx
 * <LocaleSelector />
 * ```
 *
 * @example Force dark mode
 * ```tsx
 * <LocaleSelector mode="dark" />
 * ```
 *
 * @example Manual colors (overrides auto mode)
 * ```tsx
 * <LocaleSelector background="#1a1a1a" color="#ffffff" />
 * ```
 *
 * @example Custom position and sort order
 * ```tsx
 * <LocaleSelector position="top-left" sortBy="source" />
 * ```
 */
export const LocaleSelector: React.FC<LocaleSelectorProps> = ({
	position = "bottom-right",
	mode = "auto",
	background,
	color,
	className = "",
	iconSize = 20,
	locales: localesProp,
	sortBy = "native",
}) => {
	const {
		locale,
		setLocale,
		availableLocales,
		getDisplayName,
		locales: localesFromContext,
	} = useVocoder();

	const locales = localesProp ?? localesFromContext;
	const normalizedPosition = POSITION_MAP[position] || position;

	const [systemDark, setSystemDark] = React.useState<boolean>(() => {
		if (typeof document !== "undefined") {
			const cl = document.documentElement.classList;
			if (cl.contains("dark")) return true;
			if (cl.contains("light")) return false;
		}
		if (typeof window !== "undefined") {
			return window.matchMedia("(prefers-color-scheme: dark)").matches;
		}
		return false;
	});

	React.useEffect(() => {
		if (typeof window === "undefined") return;

		const update = () => {
			const cl = document.documentElement.classList;
			if (cl.contains("dark")) { setSystemDark(true); return; }
			if (cl.contains("light")) { setSystemDark(false); return; }
			setSystemDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
		};

		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		mq.addEventListener("change", update);

		return () => {
			observer.disconnect();
			mq.removeEventListener("change", update);
		};
	}, []);

	const isDark = mode === "dark" || (mode === "auto" && systemDark);

	const resolvedBackground = background ?? (isDark ? "#1a1a1a" : "#ffffff");
	const resolvedColor = color ?? (isDark ? "#ffffff" : "#000000");
	const logoFill = isDark ? LOGO_FILL_DARK : LOGO_FILL_LIGHT;

	const getDropdownProps = () => {
		switch (normalizedPosition) {
			case "top-left":
				return { side: "bottom" as const, align: "start" as const };
			case "top-right":
				return { side: "bottom" as const, align: "end" as const };
			case "bottom-left":
				return { side: "top" as const, align: "start" as const };
			default:
				return { side: "top" as const, align: "end" as const };
		}
	};

	const { side, align } = getDropdownProps();

	const sortedLocales = React.useMemo(() => {
		if (!locales) {
			return availableLocales;
		}

		return [...availableLocales].sort((a: string, b: string) => {
			let nameA: string;
			let nameB: string;
			let compareLocale: string;

			switch (sortBy) {
				case "native":
					nameA = locales[a]?.nativeName || a;
					nameB = locales[b]?.nativeName || b;
					compareLocale = "en";
					break;

				case "translated":
					nameA = getDisplayName(a);
					nameB = getDisplayName(b);
					compareLocale = locale;
					break;
				default:
					nameA = getDisplayName(a, "en");
					nameB = getDisplayName(b, "en");
					compareLocale = "en";
					break;
			}

			return nameA.localeCompare(nameB, compareLocale, { sensitivity: "base" });
		});
	}, [availableLocales, locale, locales, sortBy, getDisplayName]);

	const getPositionStyles = (): React.CSSProperties => {
		const baseStyles: React.CSSProperties = {
			position: "fixed",
			zIndex: 9999,
		};

		switch (normalizedPosition) {
			case "top-left":
				return { ...baseStyles, top: "20px", left: "20px" };
			case "top-right":
				return { ...baseStyles, top: "20px", right: "20px" };
			case "bottom-left":
				return { ...baseStyles, bottom: "20px", left: "20px" };
			default:
				return { ...baseStyles, bottom: "20px", right: "20px" };
		}
	};

	const buttonStyles: React.CSSProperties = {
		width: "48px",
		height: "48px",
		borderRadius: "50%",
		backgroundColor: resolvedBackground,
		color: resolvedColor,
		border: isDark
			? "1px solid rgba(255, 255, 255, 0.1)"
			: "1px solid rgba(0, 0, 0, 0.1)",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
		transition: "all 0.2s ease",
	};

	const contentStyles: React.CSSProperties = {
		backgroundColor: resolvedBackground,
		borderRadius: "8px",
		padding: "8px",
		minWidth: "200px",
		maxHeight: "400px",
		overflowY: "auto",
		boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
		border: isDark
			? "1px solid rgba(255, 255, 255, 0.1)"
			: "1px solid rgba(0, 0, 0, 0.1)",
		zIndex: 10000,
	};

	const itemStyles: React.CSSProperties = {
		padding: "7px 12px",
		cursor: "pointer",
		borderRadius: "4px",
		fontSize: "14px",
		color: resolvedColor,
		outline: "none",
		userSelect: "none",
		transition: "background-color 0.15s ease",
	};

	const activeItemBg = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
	const hoverItemBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)";

	return (
		<div style={getPositionStyles()} className={className}>
			<style>{FOCUS_STYLE}</style>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild>
					<button
						{...{ [TRIGGER_ATTR]: "" }}
						style={buttonStyles}
						onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
							e.currentTarget.style.transform = "scale(1.05)";
							e.currentTarget.style.boxShadow =
								"0 4px 12px rgba(0, 0, 0, 0.15)";
						}}
						onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
							e.currentTarget.style.transform = "scale(1)";
							e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
						}}
						aria-label="Select language"
					>
						<VocoderLogo fill={logoFill} size={iconSize} />
					</button>
				</DropdownMenu.Trigger>

				<DropdownMenu.Portal>
					<DropdownMenu.Content
						style={contentStyles}
						side={side}
						align={align}
						sideOffset={8}
					>
						{sortedLocales.map((lang: string) => {
							const isActive = lang === locale;
							return (
								<DropdownMenu.Item
									key={lang}
									style={{
										...itemStyles,
										fontWeight: isActive ? "600" : "400",
										backgroundColor: isActive ? activeItemBg : "transparent",
									}}
									onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
										if (!isActive) {
											e.currentTarget.style.backgroundColor = hoverItemBg;
										}
									}}
									onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
										if (!isActive) {
											e.currentTarget.style.backgroundColor = "transparent";
										}
									}}
									onSelect={() => setLocale(lang)}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
										}}
									>
										<span>{locales?.[lang]?.nativeName || lang}</span>
										{isActive && (
											<span style={{ marginLeft: "8px", fontSize: "12px" }}>
												✓
											</span>
										)}
									</div>
								</DropdownMenu.Item>
							);
						})}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
	);
};
