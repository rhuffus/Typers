import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "tsc/_submodules/TypeScript");
const expected = "4d4f005c8541e0255a9d8791205fdce326e462bc";
const git = (...args) => execFileSync("git", args, { cwd: destination, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
mkdirSync(destination, { recursive: true });
if (existsSync(path.join(destination, ".git"))) {
  const actual = git("rev-parse", "HEAD");
  if (actual !== expected) throw new Error(`Corpus at ${actual}; expected ${expected}. Existing checkout was not modified.`);
  if (git("status", "--porcelain")) throw new Error("Corpus has local changes; refusing to use it as a clean reference.");
} else {
  if (readdirSync(destination).length) throw new Error("Corpus directory is not empty; refusing to overwrite it.");
  git("init", "--quiet");
  git("remote", "add", "origin", "https://github.com/microsoft/TypeScript.git");
  git("fetch", "--depth=1", "--no-tags", "origin", expected);
  git("checkout", "--quiet", "--detach", "FETCH_HEAD");
  if (git("rev-parse", "HEAD") !== expected) throw new Error("Unexpected corpus commit.");
}
console.log(`Native test corpus ready at ${expected}`);
