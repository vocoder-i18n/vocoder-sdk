// Proves the 6 fixture cases from
// specs/015-blast-radius-spec-section/data-model.md's "Test fixtures" list.
// Writes real spec.md files to a temp dir (matching verify.test.ts's own
// convention for exercising file-reading gate logic — see its "fails when
// the record is missing" case) rather than mocking `fs`, since
// `checkBlastRadius` is a thin, pure-ish wrapper around real reads.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BranchResolution } from "../verify/branch";
import { checkBlastRadius } from "../verify/blast-radius";

const FULL_SECTION = `## Blast Radius *(mandatory)*

<!--
  ACTION REQUIRED: Fill all four subsections before running /speckit-plan.
-->

### Layers touched

- [x] SDK runtime
- [ ] Extractor
- [ ] Plugin
- [ ] CLI
- [ ] GitHub Action
- [ ] REST API
- [ ] Worker
- [ ] Database
- [ ] CDN bundle
- [ ] Dashboard UI
- [ ] Billing/credits
- [ ] Email

### Downstream effects

The extractor reads the SDK runtime's exported types; a shift here breaks its parsing.

### Coupling map entries

react/src/types.ts row — honored, mcp/docs/sdk-reference.md updated in this same change.

### Journey position

This sits before extraction — nothing in the canonical flow runs before it.

## User Scenarios & Testing *(mandatory)*

placeholder body
`;

const NONE_SECTION = `## Blast Radius *(mandatory)*

### Layers touched

- [ ] SDK runtime
- [ ] Extractor
- [ ] Plugin
- [ ] CLI
- [ ] GitHub Action
- [ ] REST API
- [ ] Worker
- [ ] Database
- [ ] CDN bundle
- [ ] Dashboard UI
- [ ] Billing/credits
- [ ] Email

### Downstream effects

None

### Coupling map entries

None

### Journey position

None

## User Scenarios & Testing *(mandatory)*

placeholder body
`;

const MISSING_HEADING_SPEC = `# Feature Specification: Some Feature

**Feature Branch**: \`999-some-feature\`

**Input**: User description: "test"

## User Scenarios & Testing *(mandatory)*

placeholder body
`;

const PLACEHOLDER_JOURNEY_SPEC = `## Blast Radius *(mandatory)*

### Layers touched

- [x] Worker

### Downstream effects

The job processor consumes this queue payload shape.

### Coupling map entries

None

### Journey position

[Where in the canonical translation flow (extract → submit → translate → compile → deliver) this change sits, and what runs immediately after it. "None"/"N/A" if this change is entirely outside that flow (e.g. pure process tooling).]

## User Scenarios & Testing *(mandatory)*

placeholder body
`;

const tempDirs: string[] = [];

function makeSpecFixture(specDirName: string, content: string): string {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-radius-"));
	tempDirs.push(rootDir);
	const specDir = path.join(rootDir, "specs", specDirName);
	fs.mkdirSync(specDir, { recursive: true });
	fs.writeFileSync(path.join(specDir, "spec.md"), content, "utf8");
	return rootDir;
}

function ticketBranch(ticket: string, branch: string): BranchResolution {
	return { exempt: false, branch, ticket };
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("checkBlastRadius", () => {
	it("passes when the section is fully filled", () => {
		const rootDir = makeSpecFixture("015-blast-radius-spec-section", FULL_SECTION);

		const result = checkBlastRadius(rootDir, ticketBranch("015", "015-blast-radius-spec-section"));

		expect(result.status).toBe("pass");
	});

	it("passes when every prose subsection explicitly says None", () => {
		const rootDir = makeSpecFixture("015-blast-radius-spec-section", NONE_SECTION);

		const result = checkBlastRadius(rootDir, ticketBranch("015", "015-blast-radius-spec-section"));

		expect(result.status).toBe("pass");
	});

	it("fails, naming the section, when the Blast Radius heading is missing entirely", () => {
		const rootDir = makeSpecFixture("999-some-feature", MISSING_HEADING_SPEC);

		const result = checkBlastRadius(rootDir, ticketBranch("999", "999-some-feature"));

		expect(result.status).toBe("fail");
		expect(result.detail).toContain("Blast Radius section missing");
	});

	it("fails, naming Journey position, when it still contains the template placeholder text", () => {
		const rootDir = makeSpecFixture(
			"042-worker-queue-change",
			PLACEHOLDER_JOURNEY_SPEC,
		);

		const result = checkBlastRadius(rootDir, ticketBranch("042", "042-worker-queue-change"));

		expect(result.status).toBe("fail");
		expect(result.detail).toContain("Journey position");
	});

	it("skips when the branch names no ticket", () => {
		const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-radius-"));
		tempDirs.push(rootDir);

		const result = checkBlastRadius(rootDir, { exempt: true, branch: "main" });

		expect(result.status).toBe("skip");
	});

	it("skips when the ticket has no matching specs/<ticket>-* directory", () => {
		const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-radius-"));
		tempDirs.push(rootDir);
		fs.mkdirSync(path.join(rootDir, "specs"), { recursive: true });

		const result = checkBlastRadius(rootDir, ticketBranch("777", "777-nonexistent"));

		expect(result.status).toBe("skip");
	});
});
