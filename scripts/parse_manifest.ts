/**
 * Manifest parser helper for e2e_test.sh
 *
 * Usage:
 *   npx tsx scripts/parse_manifest.ts names     # print scenario names, one per line
 *   npx tsx scripts/parse_manifest.ts result <name>  # print "pass" or "fail"
 *   npx tsx scripts/parse_manifest.ts constraint <name>  # print expected failed constraint
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "..", "circuits", "test_vectors", "manifest.json");

interface Scenario {
  name: string;
  description: string;
  expectedResult: "pass" | "fail";
  failedConstraint: string | null;
}

const manifest: Scenario[] = JSON.parse(readFileSync(manifestPath, "utf-8"));

const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "names":
    for (const s of manifest) {
      console.log(s.name);
    }
    break;
  case "result": {
    const s = manifest.find((s) => s.name === arg);
    if (!s) {
      process.exit(1);
    }
    console.log(s.expectedResult);
    break;
  }
  case "constraint": {
    const s = manifest.find((s) => s.name === arg);
    if (!s || !s.failedConstraint) {
      process.exit(1);
    }
    console.log(s.failedConstraint);
    break;
  }
  default:
    console.error("Usage: parse_manifest.ts [names|result|constraint] [name]");
    process.exit(1);
}
