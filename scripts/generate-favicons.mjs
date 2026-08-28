import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

async function fetchIcon(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function writeIcoFromPng(pngPath, icoPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["--yes", "png-to-ico", pngPath],
      { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
    );
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`png-to-ico exited with code ${code}`));
        return;
      }
      void writeFile(icoPath, Buffer.concat(chunks)).then(resolve, reject);
    });
  });
}

async function main() {
  const baseUrl = process.env.ICON_BASE_URL ?? "http://localhost:3456";
  await mkdir(publicDir, { recursive: true });

  const iconPng = await fetchIcon(`${baseUrl}/icon`);
  const applePng = await fetchIcon(`${baseUrl}/apple-icon`);
  const iconPath = path.join(publicDir, "icon.png");
  const applePath = path.join(publicDir, "apple-icon.png");
  const icoPath = path.join(publicDir, "favicon.ico");

  await writeFile(iconPath, iconPng);
  await writeFile(applePath, applePng);
  await writeIcoFromPng(iconPath, icoPath);

  console.log("Generated public/icon.png, public/apple-icon.png, public/favicon.ico");
}

void main();
