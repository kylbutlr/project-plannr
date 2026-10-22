import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.join(exampleRoot, "dist");
const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("app-stylr/package.json"));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "vendor", "app-stylr"), { recursive: true });

await Promise.all([
  cp(path.join(exampleRoot, "index.html"), path.join(outputRoot, "index.html")),
  cp(path.join(exampleRoot, "styles.css"), path.join(outputRoot, "styles.css")),
  cp(path.join(packageRoot, "adapters"), path.join(outputRoot, "vendor", "app-stylr", "adapters"), { recursive: true }),
  cp(path.join(packageRoot, "assets", "fonts"), path.join(outputRoot, "vendor", "app-stylr", "assets", "fonts"), { recursive: true })
]);

console.log("Built the App Stylr web example in dist/.");
