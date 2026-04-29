import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"locale-selector": "src/locale-selector.ts",
		server: "src/server.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	sourcemap: true,
	target: "es2017",
	platform: "neutral",
	external: [
		"react",
		"react/jsx-runtime",
		"react-dom",
		"intl-messageformat",
		"@radix-ui/react-dropdown-menu",
		"lucide-react",
		/^virtual:/,
	],
});
