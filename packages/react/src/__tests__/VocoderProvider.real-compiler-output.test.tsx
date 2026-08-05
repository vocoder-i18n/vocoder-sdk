/**
 * Proves that real compileLocaleFiles/generateLocaleLoader output (captured from
 * app's compile-locale-files-shape.test.ts integration test) renders correctly
 * through VocoderProvider — not a hand-crafted approximation of the compiler's
 * shape, but the actual manifest/locale-bundle shape it produces.
 *
 * Uses test/fixtures/real-manifest.ts and test/fixtures/real-locale-loader.ts,
 * which are separate, additive fixtures — this file does not touch or depend on
 * the existing hand-crafted manifest.ts/locale-loader.ts fixtures the rest of
 * this suite uses.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useVocoder, VocoderProvider } from "../VocoderProvider";
import realManifest from "../../test/fixtures/real-manifest";
import { loadRealLocale } from "../../test/fixtures/real-locale-loader";

function RealCompilerOutputConsumer() {
	const { locale, setLocale, isReady, t } = useVocoder();
	return (
		<div>
			<div data-testid="locale">{locale}</div>
			<div data-testid="ready">{String(isReady)}</div>
			<div data-testid="hello">{t("Hello")}</div>
			<div data-testid="goodbye">{t("Goodbye")}</div>
			<div data-testid="save-changes">{t("Save changes")}</div>
			<button onClick={() => setLocale("es")}>Switch to Spanish</button>
		</div>
	);
}

describe("VocoderProvider renders real compiler output", () => {
	it("resolves real hash-keyed translations for es after switching from the source locale", async () => {
		const user = userEvent.setup();

		render(
			<VocoderProvider manifest={realManifest} loadLocale={loadRealLocale}>
				<RealCompilerOutputConsumer />
			</VocoderProvider>,
		);

		await waitFor(() => {
			expect(screen.getByTestId("ready")).toHaveTextContent("true");
		});

		expect(screen.getByTestId("locale")).toHaveTextContent("en");
		expect(screen.getByTestId("hello")).toHaveTextContent("Hello");
		expect(screen.getByTestId("goodbye")).toHaveTextContent("Goodbye");
		expect(screen.getByTestId("save-changes")).toHaveTextContent("Save changes");

		await user.click(screen.getByText("Switch to Spanish"));

		await waitFor(() => {
			expect(screen.getByTestId("locale")).toHaveTextContent("es");
			expect(screen.getByTestId("hello")).toHaveTextContent("Hola");
			expect(screen.getByTestId("goodbye")).toHaveTextContent("Adiós");
			expect(screen.getByTestId("save-changes")).toHaveTextContent("Guardar cambios");
		});
	});
});
