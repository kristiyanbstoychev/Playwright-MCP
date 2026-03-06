import { readFile } from "fs/promises";
import { capturePageSnapshot } from "./mcp.js";
import { generateTestPlan, saveTestPlan } from "./planner.js";
import { generatePlaywrightTests } from "./generator.js";
import type { Config } from "./types.js";

const config: Config = {
  mcpServerUrl: "http://localhost:8931/sse",
  ollamaHost:   "http://localhost:11434",
  ollamaModel:  "qwen2.5-coder:latest",
};

const USAGE = `
Usage:
  Plan mode    — analyse a page and produce a test plan:
    npm start -- plan <url>

  Generate mode — follow instructions and produce a .spec.ts file:
    npm start -- generate <url> --instructions <instructions.txt> --output <output.spec.ts>

Options (generate mode):
  --instructions  Path to a .txt file containing test instructions (one per line)
  --output        Path where the generated .spec.ts file will be saved

Examples:
  npm start -- plan https://demo.playwright.dev/todomvc
  npm start -- generate https://demo.playwright.dev/todomvc --instructions instructions.txt --output todo.spec.ts
`.trim();

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (!result["_mode"]) {
      result["_mode"] = args[i];
    } else if (!result["_url"]) {
      result["_url"] = args[i];
    }
  }
  return result;
}

async function runPlanMode(url: string): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("  Mode: Test Plan");
  console.log(`  Target URL: ${url}`);
  console.log("=".repeat(60) + "\n");

  const snapshot = await capturePageSnapshot(config, url);

  if (!snapshot.content.trim()) {
    console.error("[ERROR] Empty snapshot. Check the URL and Docker logs.");
    process.exit(1);
  }

  const testPlan = await generateTestPlan(config, snapshot);

  console.log("\n" + "=".repeat(60));
  console.log("  GENERATED TEST PLAN");
  console.log("=".repeat(60));
  console.log(testPlan.markdown);

  await saveTestPlan(testPlan, "test_plan.md");
}

async function runGenerateMode(
  url: string,
  instructionsPath: string,
  outputPath: string
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("  Mode: Test Generation");
  console.log(`  Target URL:   ${url}`);
  console.log(`  Instructions: ${instructionsPath}`);
  console.log(`  Output:       ${outputPath}`);
  console.log("=".repeat(60) + "\n");

  // Read instructions file
  let instructions: string;
  try {
    instructions = await readFile(instructionsPath, "utf-8");
  } catch {
    console.error(`[ERROR] Could not read instructions file: ${instructionsPath}`);
    process.exit(1);
  }

  if (!instructions.trim()) {
    console.error("[ERROR] Instructions file is empty.");
    process.exit(1);
  }

  const snapshot = await capturePageSnapshot(config, url);

  if (!snapshot.content.trim()) {
    console.error("[ERROR] Empty snapshot. Check the URL and Docker logs.");
    process.exit(1);
  }

  await generatePlaywrightTests(config, snapshot, instructions, outputPath);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const parsed = parseArgs(args);
  const mode = parsed["_mode"];
  const url  = parsed["_url"];

  if (!url) {
    console.error("[ERROR] No URL provided.\n");
    console.log(USAGE);
    process.exit(1);
  }

  switch (mode) {
    case "plan":
      await runPlanMode(url);
      break;

    case "generate": {
      const instructionsPath = parsed["instructions"];
      const outputPath       = parsed["output"];

      if (!instructionsPath || !outputPath) {
        console.error("[ERROR] --instructions and --output are required in generate mode.\n");
        console.log(USAGE);
        process.exit(1);
      }

      await runGenerateMode(url, instructionsPath, outputPath);
      break;
    }

    default:
      console.error(`[ERROR] Unknown mode: "${mode}". Use "plan" or "generate".\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});