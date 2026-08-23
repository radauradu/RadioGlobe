import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const target = path.join(root, "public", "cesium");
const packageJson = JSON.parse(
  await readFile(path.join(root, "node_modules", "cesium", "package.json"), "utf8"),
);
const marker = path.join(target, ".version");

const isVercel = process.env.VERCEL === "1";

try {
  if (
    !isVercel &&
    (await readFile(marker, "utf8")).trim() === packageJson.version
  ) {
    process.exit(0);
  }
} catch {
  // Assets have not been copied for this Cesium version yet.
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const directory of ["Assets", "ThirdParty", "Widgets", "Workers"]) {
  await cp(path.join(source, directory), path.join(target, directory), {
    recursive: true,
  });
}
await cp(path.join(source, "Cesium.js"), path.join(target, "Cesium.js"));
await writeFile(marker, `${packageJson.version}\n`);
