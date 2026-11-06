import { createRequire } from "node:module";

// One level up from src/, dist/ and the bundle alike, so this works in tests, tsc output and on npm.
export const VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
