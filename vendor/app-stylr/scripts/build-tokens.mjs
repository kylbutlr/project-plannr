import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readTokens, renderCss, renderSwift, repoRoot } from "./token-utils.mjs";

const checkOnly = process.argv.includes("--check");
const tokens = await readTokens();
const outputs = [
  {
    path: path.join(repoRoot, "adapters", "css", "app-stylr.css"),
    content: renderCss(tokens)
  },
  {
    path: path.join(repoRoot, "adapters", "swift", "AppStylrTokens.swift"),
    content: renderSwift(tokens)
  }
];

let driftDetected = false;

for (const output of outputs) {
  if (checkOnly) {
    let existing = "";
    try {
      existing = await readFile(output.path, "utf8");
    } catch {
      // A missing generated file is drift and is reported below.
    }

    if (existing !== output.content) {
      console.error(`Generated adapter is stale: ${path.relative(repoRoot, output.path)}`);
      driftDetected = true;
    }
    continue;
  }

  await mkdir(path.dirname(output.path), { recursive: true });
  await writeFile(output.path, output.content);
  console.log(`Generated ${path.relative(repoRoot, output.path)}`);
}

if (driftDetected) {
  console.error("Run npm run build and commit the generated adapters.");
  process.exitCode = 1;
} else if (checkOnly) {
  console.log("Generated adapters are current.");
}
