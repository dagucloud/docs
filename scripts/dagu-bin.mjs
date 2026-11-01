import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const docsRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Resolves the Dagu executable: DAGU_BIN, then the given path, then a build in
// the parent Dagu checkout, then `dagu` on PATH.
export function findDaguBin(pathArgument) {
  const configuredBin = process.env.DAGU_BIN || pathArgument;
  if (configuredBin) {
    return configuredBin;
  }

  const siblingBuild = resolve(docsRoot, "..", ".local", "bin", "dagu");
  try {
    accessSync(siblingBuild, constants.X_OK);
    return siblingBuild;
  } catch {
    return "dagu";
  }
}
