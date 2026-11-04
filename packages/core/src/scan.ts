import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface Finding {
  /** skill folder, relative to the scanned root */
  skill: string;
  /** file inside the skill */
  file: string;
  rule: "hidden-unicode";
  line: number;
  /** 1-based, counted in characters (code points) */
  column: number;
  detail: string;
}

export interface HiddenChar { line: number; column: number; codePoint: string; name: string }

// Characters that change what a model reads without showing anything to a human reviewer.
const NAMES: Record<number, string> = {
  0x200b: "zero width space",
  0x200c: "zero width non-joiner",
  0x200d: "zero width joiner",
  0x200e: "left-to-right mark",
  0x200f: "right-to-left mark",
  0x2060: "word joiner",
  0x2061: "invisible function application",
  0x2062: "invisible times",
  0x2063: "invisible separator",
  0x2064: "invisible plus",
  0xfeff: "zero width no-break space",
  0x180e: "mongolian vowel separator",
  0x202a: "left-to-right embedding",
  0x202b: "right-to-left embedding",
  0x202c: "pop directional formatting",
  0x202d: "left-to-right override",
  0x202e: "right-to-left override",
  0x2066: "left-to-right isolate",
  0x2067: "right-to-left isolate",
  0x2068: "first strong isolate",
  0x2069: "pop directional isolate",
};

const nameOf = (cp: number) => NAMES[cp] ?? (cp >= 0xe0000 && cp <= 0xe007f ? "tag character" : undefined);
const EMOJI = /\p{Extended_Pictographic}/u;
const ARABIC_SCRIPT = /\p{Script=Arabic}/u;

/**
 * Invisible characters in text, with their position. To keep noise low, joiners with an everyday
 * use are allowed: a zero width joiner between emoji, a zero width non-joiner between Arabic-script
 * letters (Persian uses it), and a byte order mark as the very first character.
 */
export function findHiddenUnicode(text: string): HiddenChar[] {
  const out: HiddenChar[] = [];
  text.split(/\r?\n/).forEach((lineText, i) => {
    const chars = [...lineText];
    chars.forEach((ch, j) => {
      const cp = ch.codePointAt(0)!;
      const name = nameOf(cp);
      if (!name) return;
      const prev = chars[j - 1] ?? "";
      const next = chars[j + 1] ?? "";
      if (cp === 0x200d && EMOJI.test(prev) && EMOJI.test(next)) return;
      if (cp === 0x200c && ARABIC_SCRIPT.test(prev) && ARABIC_SCRIPT.test(next)) return;
      if (cp === 0xfeff && i === 0 && j === 0) return;
      out.push({ line: i + 1, column: j + 1, codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, name });
    });
  });
  return out;
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isDirectory()) files(p, out);
    else if (st.isFile()) out.push(p);
  }
  return out;
}

/** Scan every text file of every skill; binary files (containing a NUL byte) and symlinks are skipped. */
export function scanSkillFolders(skills: Record<string, string>): Finding[] {
  const findings: Finding[] = [];
  for (const [skill, dir] of Object.entries(skills)) {
    for (const path of files(dir)) {
      const buf = readFileSync(path);
      if (buf.includes(0)) continue;
      const file = relative(dir, path).split("\\").join("/");
      for (const h of findHiddenUnicode(buf.toString("utf8"))) {
        findings.push({ skill, file, rule: "hidden-unicode", line: h.line, column: h.column, detail: `${h.codePoint} ${h.name}` });
      }
    }
  }
  return findings;
}
