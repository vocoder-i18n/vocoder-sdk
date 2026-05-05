import chalk from "chalk";

const ORANGE = "#FC5206";
const PINK = "#D51977";
const BLUE = "#2450A9";

const noColor = process.env.NO_COLOR === "1" || process.env.FORCE_COLOR === "0";
const hex = (color: string) => (s: string) =>
	noColor ? s : chalk.hex(color)(s);

export const dim = (s: string) => (noColor ? s : chalk.dim(s));
export const bld = (s: string) => (noColor ? s : chalk.bold(s));
export const grn = (s: string) => (noColor ? s : chalk.green(s));
export const ylw = (s: string) => (noColor ? s : chalk.yellow(s));
export const red = (s: string) => (noColor ? s : chalk.red(s));

/** Named values: file paths, locale codes, branch names, variable names */
export const highlight = hex(PINK);

/** Structural info: bars, info logs, notes, links, selected checkmarks */
export const info = hex(BLUE);

/** Brand identity: intro/outro text, active cursor ◆, spinner label accents */
export const active = hex(ORANGE);
