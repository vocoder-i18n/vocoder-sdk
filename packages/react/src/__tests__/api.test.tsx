/**
 * Canonical API surface tests.
 * Each describe block maps to one answered API design question.
 * These are the source of truth for what the public API guarantees.
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { T } from "../T";
import { VocoderProvider } from "../VocoderProvider";

// ─── Q1: Static text ────────────────────────────────────────────────────────
// Both children and message prop are valid. Same extraction, same behavior.

describe("Q1 — static text", () => {
	it("renders static children in source locale", async () => {
		render(
			<VocoderProvider>
				<T>Hello, world!</T>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hello, world!")).toBeInTheDocument(),
		);
	});

	it("renders static message prop in source locale", async () => {
		render(
			<VocoderProvider>
				<T message="Hello, world!" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hello, world!")).toBeInTheDocument(),
		);
	});

	it("translates static children", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T>Hello, world!</T>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hola, mundo!")).toBeInTheDocument(),
		);
	});

	it("translates static message prop", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T message="Hello, world!" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hola, mundo!")).toBeInTheDocument(),
		);
	});

	it("falls back to source text when no translation exists", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T>Untranslated string</T>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Untranslated string")).toBeInTheDocument(),
		);
	});

	it("message prop takes precedence over children", async () => {
		render(
			<VocoderProvider>
				<T message="Hello, world!">Ignored children</T>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hello, world!")).toBeInTheDocument(),
		);
		expect(screen.queryByText("Ignored children")).not.toBeInTheDocument();
	});
});

// ─── Q3: Pluralization ──────────────────────────────────────────────────────
// A) Shorthand props — ergonomic JSX authoring
// B) Raw ICU in message — for complex cases (offset, nested selects, etc.)
// Both valid.

describe("Q3 — pluralization", () => {
	it("shorthand: one/other", async () => {
		render(
			<VocoderProvider>
				<T value={1} one="# item" other="# items" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("1 item")).toBeInTheDocument(),
		);
	});

	it("shorthand: one/other plural count", async () => {
		render(
			<VocoderProvider>
				<T value={5} one="# item" other="# items" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("5 items")).toBeInTheDocument(),
		);
	});

	it("shorthand: exact match _0 overrides other", async () => {
		render(
			<VocoderProvider>
				<T value={0} _0="No items" one="# item" other="# items" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("No items")).toBeInTheDocument(),
		);
	});

	it("shorthand: translates plural ICU", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T value={3} _0="No items" one="# item" other="# items" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("3 articulos")).toBeInTheDocument(),
		);
	});

	it("raw ICU in message: formats plural", async () => {
		render(
			<VocoderProvider>
				<T
					message="{count, plural, =0 {No items} one {# item} other {# items}}"
					values={{ count: 2 }}
				/>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("2 items")).toBeInTheDocument(),
		);
	});

	it("raw ICU in message: translates plural", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T
					message="{count, plural, =0 {No items} one {# item} other {# items}}"
					values={{ count: 5 }}
				/>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("5 articulos")).toBeInTheDocument(),
		);
	});

	it("ordinal: formats rank with selectordinal", async () => {
		render(
			<VocoderProvider>
				<T value={1} ordinal one="#st" two="#nd" few="#rd" other="#th" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("1st")).toBeInTheDocument(),
		);
	});

	it("ordinal: translates selectordinal", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T value={1} ordinal one="#st" two="#nd" few="#rd" other="#th" />
			</VocoderProvider>,
		);
		// Spanish CLDR ordinal rules classify all numbers as "other"
		await waitFor(() =>
			expect(screen.getByText("1to")).toBeInTheDocument(),
		);
	});

	it("CLDR few: Polish value=2 uses few category", async () => {
		document.cookie = "vocoder_locale=pl; Path=/";
		render(
			<VocoderProvider>
				<T value={2} one="# item" other="# items" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("2 przedmioty")).toBeInTheDocument(),
		);
	});

	it("CLDR many: Polish value=5 uses many category", async () => {
		document.cookie = "vocoder_locale=pl; Path=/";
		render(
			<VocoderProvider>
				<T value={5} one="# item" other="# items" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("5 przedmiotow")).toBeInTheDocument(),
		);
	});
});

// ─── Q4: Select (enum branching) ────────────────────────────────────────────
// A) Shorthand _word props — ergonomic for simple cases
// B) Raw ICU in message — when select is embedded in surrounding text
// Both valid.

describe("Q4 — select", () => {
	it("shorthand: matches _word prop for value", async () => {
		render(
			<VocoderProvider>
				<T value="female" _male="his" _female="her" other="their" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("her")).toBeInTheDocument(),
		);
	});

	it("shorthand: falls back to other", async () => {
		render(
			<VocoderProvider>
				<T value="nonbinary" _male="his" _female="her" other="their" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("their")).toBeInTheDocument(),
		);
	});

	it("shorthand: translates select ICU", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T value="male" _male="his" _female="her" other="their" />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("su")).toBeInTheDocument(),
		);
	});

	it("raw ICU: select embedded in surrounding text", async () => {
		render(
			<VocoderProvider>
				<T
					message="{gender, select, male {He} female {She} other {They}} replied"
					values={{ gender: "female" }}
				/>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("She replied")).toBeInTheDocument(),
		);
	});

	it("raw ICU: translates select with surrounding text", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T
					message="{gender, select, male {He} female {She} other {They}} replied"
					values={{ gender: "female" }}
				/>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Ella respondio")).toBeInTheDocument(),
		);
	});
});

// ─── Q5: Rich text / component placeholders ─────────────────────────────────
// components prop accepts ReactElement[]. Index maps to <cN> in the message.
// Natural JSX syntax handled by build plugin — explicit form always valid.

describe("Q5 — rich text", () => {
	it("renders single component placeholder", async () => {
		render(
			<VocoderProvider>
				<T
					message="Click <c0>here</c0> for help"
					components={[<a href="/help" />]}
				/>
			</VocoderProvider>,
		);
		await waitFor(() => {
			const link = screen.getByText("here");
			expect(link.tagName).toBe("A");
			expect(link).toHaveAttribute("href", "/help");
		});
	});

	it("translates then renders component placeholder", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T
					message="Click <c0>here</c0> for help"
					components={[<a href="/ayuda" />]}
				/>
			</VocoderProvider>,
		);
		await waitFor(() => {
			const link = screen.getByText("aqui");
			expect(link.tagName).toBe("A");
		});
	});

	it("renders multiple component placeholders", async () => {
		render(
			<VocoderProvider>
				<T
					message="Read our <c0>Privacy Policy</c0> and <c1>Terms of Service</c1>"
					components={[<a href="/privacy" />, <a href="/terms" />]}
				/>
			</VocoderProvider>,
		);
		await waitFor(() => {
			expect(screen.getByText("Privacy Policy")).toHaveAttribute("href", "/privacy");
			expect(screen.getByText("Terms of Service")).toHaveAttribute("href", "/terms");
		});
	});

	it("combines ICU variables with component placeholders", async () => {
		render(
			<VocoderProvider>
				<T
					message="Hello {name}, read <c0>the docs</c0>."
					values={{ name: "John" }}
					components={[<a href="/docs" />]}
				/>
			</VocoderProvider>,
		);
		await waitFor(() => {
			expect(screen.getByText(/Hello John, read/)).toBeInTheDocument();
			expect(screen.getByText("the docs")).toHaveAttribute("href", "/docs");
		});
	});

	it("renders self-closing component placeholder", async () => {
		render(
			<VocoderProvider>
				<T
					message="Upload complete <c0/>"
					components={[<span data-testid="icon" />]}
				/>
			</VocoderProvider>,
		);
		await waitFor(() => {
			expect(screen.getByTestId("icon")).toBeInTheDocument();
		});
	});

	it("renders nested component placeholders", async () => {
		render(
			<VocoderProvider>
				<T
					message="Read <c0>our <c1>docs</c1> now</c0>"
					components={[<a href="/docs" />, <strong />]}
				/>
			</VocoderProvider>,
		);
		await waitFor(() => {
			const link = screen.getByRole("link");
			expect(link).toHaveAttribute("href", "/docs");
			expect(link.querySelector("strong")).toBeInTheDocument();
			expect(screen.getByText("docs")).toBeInTheDocument();
		});
	});
});

// ─── Q6: Format prop ─────────────────────────────────────────────────────────
// Pure Intl formatting — no translation lookup. Value rendered per locale.
// Expected values computed at test time via Intl APIs to avoid brittleness
// across Node.js / ICU versions.

describe("Q6 — format prop", () => {
	const FIXED_DATE = new Date("2024-06-15T14:30:00.000Z");

	it("format=number formats integer with locale separators", async () => {
		const expected = new Intl.NumberFormat("en").format(1_234_567);
		render(
			<VocoderProvider>
				<T format="number" value={1_234_567} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=integer rounds to whole number", async () => {
		const expected = new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(1234.7);
		render(
			<VocoderProvider>
				<T format="integer" value={1234.7} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=percent formats 0–1 as percentage", async () => {
		const expected = new Intl.NumberFormat("en", { style: "percent" }).format(0.75);
		render(
			<VocoderProvider>
				<T format="percent" value={0.75} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=compact abbreviates large numbers", async () => {
		const expected = new Intl.NumberFormat("en", { notation: "compact" }).format(1_500_000);
		render(
			<VocoderProvider>
				<T format="compact" value={1_500_000} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=date renders medium date by default", async () => {
		const expected = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(FIXED_DATE);
		render(
			<VocoderProvider>
				<T format="date" value={FIXED_DATE} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=date respects dateStyle prop", async () => {
		const expected = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(FIXED_DATE);
		render(
			<VocoderProvider>
				<T format="date" value={FIXED_DATE} dateStyle="long" />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=time renders short time by default", async () => {
		const expected = new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(FIXED_DATE);
		render(
			<VocoderProvider>
				<T format="time" value={FIXED_DATE} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=datetime renders date and time", async () => {
		const expected = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(FIXED_DATE);
		render(
			<VocoderProvider>
				<T format="datetime" value={FIXED_DATE} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});

	it("format=number uses active locale", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		const expected = new Intl.NumberFormat("es").format(1_234_567);
		render(
			<VocoderProvider>
				<T format="number" value={1_234_567} />
			</VocoderProvider>,
		);
		await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
	});
});

// ─── Q2: Dynamic variables ──────────────────────────────────────────────────
// A) <T>Hello, {name}!</T>  — build plugin injects message + values at build time
// B) <T message="Hello, {name}!" values={{ name }} />  — explicit, always works
// Both are valid. A simulates post-plugin output by passing message + values + children.

describe("Q2 — dynamic variables", () => {
	it("interpolates via explicit message + values", async () => {
		render(
			<VocoderProvider>
				<T message="Hello, {name}!" values={{ name: "John" }} />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hello, John!")).toBeInTheDocument(),
		);
	});

	it("translates then interpolates via message + values", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		render(
			<VocoderProvider>
				<T message="Hello, {name}!" values={{ name: "John" }} />
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hola, John!")).toBeInTheDocument(),
		);
	});

	it("natural children syntax (post-plugin form) interpolates correctly", async () => {
		// Simulates what @vocoder/plugin injects at build time:
		// <T>Hello, {name}!</T>  →  <T message="Hello, {name}!" values={{ name }}>Hello, {name}!</T>
		const name = "John";
		render(
			<VocoderProvider>
				<T message="Hello, {name}!" values={{ name }}>
					Hello, {name}!
				</T>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hello, John!")).toBeInTheDocument(),
		);
	});

	it("natural children syntax translates post-plugin", async () => {
		document.cookie = "vocoder_locale=es; Path=/";
		const name = "John";
		render(
			<VocoderProvider>
				<T message="Hello, {name}!" values={{ name }}>
					Hello, {name}!
				</T>
			</VocoderProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("Hola, John!")).toBeInTheDocument(),
		);
	});
});
