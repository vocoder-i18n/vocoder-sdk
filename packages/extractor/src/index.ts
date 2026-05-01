import { readFileSync } from "node:fs";
import { relative as pathRelative } from "node:path";
import { parse } from "@babel/parser";
import babelTraverse from "@babel/traverse";
import { glob } from "glob";
import { generateMessageHash } from "./hash";

export { generateMessageHash } from "./hash";
export { loadVocoderConfig, parseVocoderConfig } from "./config";
export type { VocoderConfig } from "./config";

// Handle default export difference between ESM and CommonJS
const traverse = (babelTraverse as any).default || babelTraverse;

// Unambiguous plural CLDR categories. "other" is excluded — it's also the
// required fallback in select mode, so it can't determine mode on its own.
const PLURAL_CLDR = new Set(["zero", "one", "two", "few", "many"]);
// Full set used only by buildPluralICU/buildSelectICU where mode is already known.
const ALL_CLDR = new Set(["zero", "one", "two", "few", "many", "other"]);

export interface ExtractedString {
	key: string;
	text: string;
	file: string;
	line: number;
	context?: string;
	formality?: "formal" | "informal" | "neutral" | "auto";
}

export interface TransformResult {
	code: string;
	changed: boolean;
}

/**
 * Default ordinal ICU — English suffix fallback, used when no locale-specific ICU is stored.
 * Must stay byte-for-byte identical to DEFAULT_ORDINAL_ICU in @vocoder/react/src/T.tsx.
 */
export const DEFAULT_ORDINAL_ICU =
	"{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}";

/**
 * Build a plural or ordinal ICU string from plural prop key/value pairs.
 * Exact matches (_0, _1) come before CLDR categories (one, other, etc.).
 * Internal variable name is always "count" for consistent lookup keys.
 * Must stay byte-for-byte identical to buildPluralICU in @vocoder/react/src/T.tsx.
 */
export function buildPluralICU(props: Record<string, string>, ordinal = false): string {
	const type = ordinal ? "selectordinal" : "plural";
	const exactParts: string[] = [];
	const cldrParts: string[] = [];

	for (const [key, text] of Object.entries(props)) {
		const exactMatch = key.match(/^_(\d+)$/);
		if (exactMatch) {
			exactParts.push(`=${exactMatch[1]} {${text}}`);
		} else if (ALL_CLDR.has(key)) {
			cldrParts.push(`${key} {${text}}`);
		}
	}

	return `{count, ${type}, ${[...exactParts, ...cldrParts].join(" ")}}`;
}

/**
 * Build a select ICU string from select prop key/value pairs.
 * Internal variable name is always "value" for consistent lookup keys.
 * Must stay byte-for-byte identical to buildSelectICU in @vocoder/react/src/T.tsx.
 */
export function buildSelectICU(props: Record<string, string>): string {
	const cases: string[] = [];
	let hasOther = false;

	for (const [key, text] of Object.entries(props)) {
		if (key === "other") {
			hasOther = true;
			cases.push(`other {${text}}`);
		} else {
			const wordCase = key.match(/^_([a-zA-Z].*)$/);
			if (wordCase) {
				cases.push(`${wordCase[1]} {${text}}`);
			}
		}
	}

	if (!hasOther) cases.push("other {other}");

	return `{value, select, ${cases.join(" ")}}`;
}

/**
 * Extract the template text from JSX children, preserving {identifier} placeholders.
 * Handles JSXText, JSXExpressionContainer (Identifier, StringLiteral, TemplateLiteral),
 * and JSX element children (mapped to numeric <c0>, <c1> component placeholders).
 */
function extractTextContentFromNodes(
	children: any[],
	elementIndex: { count: number } = { count: 0 },
): string {
	let text = "";

	for (const child of children) {
		if (child.type === "JSXText") {
			text += child.value;
		} else if (child.type === "JSXExpressionContainer") {
			const expr = child.expression;
			if (expr.type === "Identifier") {
				text += `{${expr.name}}`;
			} else if (expr.type === "StringLiteral") {
				text += expr.value;
			} else if (expr.type === "TemplateLiteral") {
				for (let i = 0; i < expr.quasis.length; i++) {
					text += expr.quasis[i].value.raw;
					if (i < expr.expressions.length) {
						const e = expr.expressions[i];
						text += e.type === "Identifier" ? `{${e.name}}` : "{value}";
					}
				}
			}
		} else if (child.type === "JSXElement") {
			const idx = elementIndex.count++;
			const isSelfClosing = child.openingElement.selfClosing;
			if (isSelfClosing) {
				text += `<c${idx}/>`;
			} else {
				const innerText = extractTextContentFromNodes(child.children, elementIndex);
				text += `<c${idx}>${innerText}</c${idx}>`;
			}
		}
	}

	return text;
}

/**
 * Transform JSX source files to inject `message` props on <T> components
 * that have dynamic identifier children but no explicit message/msg prop.
 *
 * This enables the natural authoring syntax:
 *   <T count={count}>You have {count} items</T>
 * to work correctly at runtime by injecting:
 *   <T count={count} message="You have {count} items">You have {count} items</T>
 *
 * Uses targeted string insertion (no code regeneration) so original formatting
 * is fully preserved and source maps remain accurate.
 *
 * Skips:
 * - Elements that already have message or msg prop
 * - Elements in plural/select mode (one/other/_0/_male props)
 * - Elements with no JSX expression identifier children (static text, ICU strings, ternaries)
 * - Files that don't import T from @vocoder/react
 *
 * Future framework expansion:
 * - Vue (.vue): add transformVueT() branch — needs @vue/compiler-sfc parser,
 *   converts {{ count }} template syntax to {count} placeholders
 * - Svelte (.svelte): add transformSvelteT() branch — svelte uses {count} natively,
 *   needs svelte/compiler parser for SFC structure
 * - Solid (.jsx/.tsx): same Babel parser, different import source (@vocoder/solid)
 * All frameworks share the same lookup-key convention (message prop + values object)
 * so extraction and runtime are identical regardless of framework.
 */
export function transformMsgProps(code: string): TransformResult {
	if (!code.includes("@vocoder/react")) return { code, changed: false };

	let ast: any;
	try {
		ast = parse(code, {
			sourceType: "module",
			plugins: ["jsx", "typescript"],
		});
	} catch {
		return { code, changed: false };
	}

	const tComponentNames = new Set<string>();

	traverse(ast, {
		ImportDeclaration(path: any) {
			if (path.node.source.value !== "@vocoder/react") return;
			for (const spec of path.node.specifiers) {
				if (
					spec.type === "ImportSpecifier" &&
					spec.imported.type === "Identifier" &&
					spec.imported.name === "T"
				) {
					tComponentNames.add(spec.local.name);
				}
			}
		},
	});

	if (tComponentNames.size === 0) return { code, changed: false };

	interface Insertion {
		position: number;
		text: string;
	}
	const insertions: Insertion[] = [];

	traverse(ast, {
		JSXElement(path: any) {
			const opening = path.node.openingElement;
			const tagName =
				opening.name.type === "JSXIdentifier" ? opening.name.name : null;
			if (!tagName || !tComponentNames.has(tagName)) return;

			// Skip if already has message prop
			const hasMessageProp = opening.attributes.some(
				(attr: any) =>
					attr.type === "JSXAttribute" && attr.name.name === "message",
			);
			if (hasMessageProp) return;

			// Skip if in plural/select mode (has CLDR, _N, or _word props)
			const hasPluralSelectProps = opening.attributes.some((attr: any) => {
				if (attr.type !== "JSXAttribute") return false;
				const n = attr.name.name;
				return ALL_CLDR.has(n) || /^_\d+$/.test(n) || /^_[a-zA-Z]/.test(n);
			});
			if (hasPluralSelectProps) return;

			// Warn about ternary children — can't extract a meaningful template
			const hasTernary = path.node.children.some(
				(child: any) =>
					child.type === "JSXExpressionContainer" &&
					child.expression.type === "ConditionalExpression",
			);
			if (hasTernary) {
				const line = path.node.loc?.start.line ?? "?";
				console.warn(
					`[vocoder] Ternary in <T> children at line ${line} — move ternary outside: {cond ? <T>...</T> : <T>...</T>}`,
				);
				return;
			}

			// Collect identifier names from JSX expression children
			const identifiers = new Set<string>();
			// Collect JSX element children for component placeholder injection
			interface ElementInfo { openingStart: number; openingEnd: number; selfClosing: boolean; }
			const jsxElements: ElementInfo[] = [];

			for (const child of path.node.children) {
				if (
					child.type === "JSXExpressionContainer" &&
					child.expression.type === "Identifier"
				) {
					identifiers.add(child.expression.name);
				} else if (child.type === "JSXElement") {
					jsxElements.push({
						openingStart: child.openingElement.start,
						openingEnd: child.openingElement.end,
						selfClosing: child.openingElement.selfClosing,
					});
				}
			}

			// Nothing dynamic to inject — skip
			if (identifiers.size === 0 && jsxElements.length === 0) return;

			const elementIndex = { count: 0 };
			const template = extractTextContentFromNodes(path.node.children, elementIndex).trim();
			if (!template) return;

			const escaped = template.replace(/"/g, "&quot;");
			const hash = generateMessageHash(template);

			// Build insertion text: id, message, optional values, optional components
			let insertText = ` id="${hash}" message="${escaped}"`;

			if (identifiers.size > 0) {
				insertText += ` values={{ ${[...identifiers].join(", ")} }}`;
			}

			if (jsxElements.length > 0) {
				// Reconstruct each JSX element as self-closing using source positions
				const componentParts = jsxElements.map(({ openingStart, openingEnd, selfClosing }) => {
					const openingTag = code.slice(openingStart, openingEnd);
					if (selfClosing) return openingTag;
					// Strip trailing > and make self-closing
					return openingTag.slice(0, -1).trimEnd() + " />";
				});
				insertText += ` components={[${componentParts.join(", ")}]}`;
			}

			const insertPos = opening.end - 1;
			insertions.push({ position: insertPos, text: insertText });
		},
	});

	if (insertions.length === 0) return { code, changed: false };

	// Apply in reverse order so earlier positions aren't shifted
	insertions.sort((a, b) => b.position - a.position);
	let result = code;
	for (const { position, text } of insertions) {
		result = result.slice(0, position) + text + result.slice(position);
	}

	return { code: result, changed: true };
}

export class StringExtractor {
	async extractFromProject(
		pattern: string | string[],
		projectRoot: string = process.cwd(),
		excludePattern?: string | string[],
	): Promise<ExtractedString[]> {
		const includePatterns = Array.isArray(pattern) ? pattern : [pattern];

		const defaultIgnore = [
			"**/node_modules/**",
			"**/.next/**",
			"**/dist/**",
			"**/build/**",
		];

		const ignorePatterns = excludePattern
			? [
					...defaultIgnore,
					...(Array.isArray(excludePattern)
						? excludePattern
						: [excludePattern]),
				]
			: defaultIgnore;

		const allFiles = new Set<string>();

		for (const includePattern of includePatterns) {
			const files = await glob(includePattern, {
				cwd: projectRoot,
				absolute: true,
				ignore: ignorePatterns,
			});

			for (const file of files) allFiles.add(file);
		}

		const allStrings: ExtractedString[] = [];
		const sortedFiles = Array.from(allFiles).sort();

		for (const file of sortedFiles) {
			try {
				const strings = await this.extractFromFile(file, projectRoot);
				allStrings.push(...strings);
			} catch (error) {
				console.warn(`Warning: Failed to extract from ${file}:`, error);
			}
		}

		return this.deduplicateStrings(allStrings);
	}

	private async extractFromFile(
		filePath: string,
		projectRoot: string,
	): Promise<ExtractedString[]> {
		const code = readFileSync(filePath, "utf-8");
		const strings: ExtractedString[] = [];
		const relativeFilePath = pathRelative(projectRoot, filePath)
			.split("\\")
			.join("/");

		try {
			const ast = parse(code, {
				sourceType: "module",
				plugins: ["jsx", "typescript"],
			});

			const vocoderImports = new Map<string, string>();
			const tFunctionNames = new Set<string>();

			traverse(ast, {
				ImportDeclaration: (path: any) => {
					const source = path.node.source.value;

					if (source === "@vocoder/react") {
						path.node.specifiers.forEach((spec: any) => {
							if (spec.type === "ImportSpecifier") {
								const imported =
									spec.imported.type === "Identifier"
										? spec.imported.name
										: null;
								const local = spec.local.name;

								if (imported === "T") {
									vocoderImports.set(local, "T");
								}
								if (imported === "t") {
									tFunctionNames.add(local);
								}
							}
						});
					}
				},

				VariableDeclarator: (path: any) => {
					const init = path.node.init;

					if (
						init &&
						init.type === "CallExpression" &&
						init.callee.type === "Identifier" &&
						init.callee.name === "useVocoder" &&
						path.node.id.type === "ObjectPattern"
					) {
						path.node.id.properties.forEach((prop: any) => {
							if (
								prop.type === "ObjectProperty" &&
								prop.key.type === "Identifier" &&
								prop.key.name === "t"
							) {
								const localName =
									prop.value.type === "Identifier" ? prop.value.name : "t";
								tFunctionNames.add(localName);
							}
						});
					}
				},

				CallExpression: (path: any) => {
					const callee = path.node.callee;

					const isTFunction =
						callee.type === "Identifier" && tFunctionNames.has(callee.name);

					if (!isTFunction) return;

					const firstArg = path.node.arguments[0];
					if (!firstArg) return;

					let text: string | null = null;

					if (firstArg.type === "StringLiteral") {
						text = firstArg.value;
					} else if (firstArg.type === "TemplateLiteral") {
						text = this.extractTemplateText(firstArg);
					}

					if (!text || text.trim().length === 0) return;

					// arguments[1] = values, arguments[2] = options { context, formality, id }
					const optionsArg = path.node.arguments[2];
					let context: string | undefined;
					let formality:
						| "formal"
						| "informal"
						| "neutral"
						| "auto"
						| undefined;
					let explicitKey: string | undefined;

					if (optionsArg && optionsArg.type === "ObjectExpression") {
						optionsArg.properties.forEach((prop: any) => {
							if (
								prop.type === "ObjectProperty" &&
								prop.key.type === "Identifier"
							) {
								if (
									prop.key.name === "context" &&
									prop.value.type === "StringLiteral"
								) {
									context = prop.value.value;
								}
								if (
									prop.key.name === "formality" &&
									prop.value.type === "StringLiteral"
								) {
									formality = prop.value.value as
										| "formal"
										| "informal"
										| "neutral"
										| "auto";
								}
								if (
									prop.key.name === "id" &&
									prop.value.type === "StringLiteral"
								) {
									explicitKey = prop.value.value.trim();
								}
							}
						});
					}

					const line = path.node.loc?.start.line || 0;
					const key =
						explicitKey && explicitKey.length > 0
							? explicitKey
							: generateMessageHash(text.trim(), context);

					strings.push({
						key,
						text: text.trim(),
						file: filePath,
						line,
						context,
						formality,
					});
				},

				JSXElement: (path: any) => {
					const opening = path.node.openingElement;
					const tagName =
						opening.name.type === "JSXIdentifier" ? opening.name.name : null;

					if (!tagName) return;

					const isTranslationComponent = vocoderImports.has(tagName);
					if (!isTranslationComponent) return;

					const msgAttribute =
						this.getStringAttribute(opening.attributes, "message");

					let text: string | null = null;

					if (msgAttribute) {
						text = msgAttribute;
					} else {
						// Check for plural/select mode props
						const pluralSelectICU = this.extractPluralSelectICU(
							opening.attributes,
						);
						if (pluralSelectICU) {
							text = pluralSelectICU;
						} else {
							text = extractTextContentFromNodes(path.node.children, { count: 0 });
						}
					}

					if (!text || text.trim().length === 0) return;

					const id = this.getStringAttribute(opening.attributes, "id");
					const context = this.getStringAttribute(
						opening.attributes,
						"context",
					);
					const formality = this.getStringAttribute(
						opening.attributes,
						"formality",
					) as "formal" | "informal" | "neutral" | "auto" | undefined;
					const line = path.node.loc?.start.line || 0;
					const key =
						id && id.trim().length > 0
							? id.trim()
							: generateMessageHash(text.trim(), context);

					strings.push({
						key,
						text: text.trim(),
						file: filePath,
						line,
						context,
						formality,
					});
				},
			});
		} catch (error) {
			throw new Error(
				`Failed to parse ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		return strings;
	}

	private extractPluralSelectICU(attributes: any[]): string | null {
		const pluralProps: Record<string, string> = {};
		const selectProps: Record<string, string> = {};
		let otherValue: string | undefined;
		let hasPlural = false;
		let hasSelect = false;
		let isOrdinal = false;
		let hasGender = false;

		for (const attr of attributes) {
			if (attr.type !== "JSXAttribute") continue;
			const name = attr.name.name as string;

			// Boolean `ordinal` prop — no value means true
			if (name === "ordinal") {
				isOrdinal = true;
				continue;
			}

			// `gender` prop — marks ordinal as gender-aware (dynamic value, not a string literal)
			if (name === "gender") {
				hasGender = true;
				continue;
			}

			const value =
				attr.value?.type === "StringLiteral" ? attr.value.value : null;
			if (!value) continue;

			if (PLURAL_CLDR.has(name) || /^_\d+$/.test(name)) {
				pluralProps[name] = value;
				hasPlural = true;
			} else if (name === "other") {
				otherValue = value;
			} else if (/^_[a-zA-Z]/.test(name)) {
				selectProps[name] = value;
				hasSelect = true;
			}
		}

		// Ordinal prop: generate default English ICU — developer writes nothing, pipeline handles locale patterns.
		// When gender prop present, wrap in gender select so the hash reflects gender-aware usage.
		if (isOrdinal) {
			const ordinalICU = "{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}";
			if (hasGender) {
				// Wrap in gender select: runtime selects word form based on dynamic gender value.
				// Masculine/feminine/other all carry same English ordinal ICU (used only as Tier 2 fallback).
				return `{gender, select, masculine {${ordinalICU}} feminine {${ordinalICU}} other {${ordinalICU}}}`;
			}
			return ordinalICU;
		}

		if (!hasPlural && !hasSelect) return null;

		if (hasPlural) {
			if (otherValue !== undefined) pluralProps.other = otherValue;
			return buildPluralICU(pluralProps, false);
		}
		if (hasSelect) {
			if (otherValue !== undefined) selectProps.other = otherValue;
			return buildSelectICU(selectProps);
		}
		return null;
	}

	private extractTemplateText(node: any): string {
		let text = "";

		for (let i = 0; i < node.quasis.length; i++) {
			const quasi = node.quasis[i];
			text += quasi.value.raw;

			if (i < node.expressions.length) {
				const expr = node.expressions[i];
				if (expr.type === "Identifier") {
					text += `{${expr.name}}`;
				} else {
					text += "{value}";
				}
			}
		}

		return text;
	}

	private getStringAttribute(
		attributes: any[],
		name: string,
	): string | undefined {
		const attr = attributes.find(
			(a) => a.type === "JSXAttribute" && a.name.name === name,
		);

		if (!attr || !attr.value) return undefined;

		if (attr.value.type === "StringLiteral") {
			return attr.value.value;
		}

		if (attr.value.type === "JSXExpressionContainer") {
			const expr = attr.value.expression;

			if (expr.type === "TemplateLiteral") {
				return this.extractTemplateText(expr);
			}

			if (expr.type === "StringLiteral") {
				return expr.value;
			}
		}

		return undefined;
	}

	private deduplicateStrings(strings: ExtractedString[]): ExtractedString[] {
		// Content-hash keys are deterministic: same text+context → same key everywhere.
		// Dedup by key (the hash) — keeps the first occurrence.
		const seen = new Set<string>();
		const unique: ExtractedString[] = [];
		for (const str of strings) {
			if (!seen.has(str.key)) {
				seen.add(str.key);
				unique.push(str);
			}
		}
		return unique;
	}

}
