import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { T } from "../T";
import { VocoderProvider } from "../VocoderProvider";

describe("Rich text formatting", () => {
	it("renders component placeholder", async () => {
		render(
			<VocoderProvider>
				<T
					message="Click <c0>here</c0> for help"
					components={[<a href="/help" className="help-link" />]}
				/>
			</VocoderProvider>,
		);

		await waitFor(() => {
			const link = screen.getByText("here");
			expect(link.tagName).toBe("A");
			expect(link).toHaveAttribute("href", "/help");
			expect(link).toHaveClass("help-link");
		});
	});

	it("translates component placeholder", async () => {
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
			expect(link).toHaveAttribute("href", "/ayuda");
		});
	});

	it("supports multiple component placeholders", async () => {
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
});
