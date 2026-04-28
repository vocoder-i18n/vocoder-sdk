import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Mock virtual modules injected by @vocoder/unplugin during tests. */
function mockVocoderVirtualModules(): Plugin {
	const fixturePath = path.resolve(
		__dirname,
		"test/fixtures/generated-manifest.ts",
	);
	return {
		name: "mock-vocoder-virtual-modules",
		resolveId(id) {
			if (id === "virtual:vocoder/manifest") return fixturePath;
			if (id.startsWith("virtual:vocoder/translations/")) return `\0${id}`;
			return null;
		},
		load(id) {
			if (id.startsWith("\0virtual:vocoder/translations/")) {
				return "export default {};";
			}
			return null;
		},
	};
}

export default defineConfig({
	plugins: [mockVocoderVirtualModules()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/__tests__/setup.ts"],
	},
});
