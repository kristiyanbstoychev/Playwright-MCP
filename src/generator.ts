import { Ollama } from "ollama";
import { writeFile } from "fs/promises";
import { Config, PageSnapshot } from "./types.js";

const SYSTEM_PROMPT = `You are a senior QA engineer and Playwright automation expert.
You will be given a structured accessibility snapshot of a web page and a set of test instructions.
Your task is to generate a complete, ready-to-run Playwright test file in TypeScript.

Requirements:
- Use @playwright/test (import { test, expect } from '@playwright/test')
- Use data-testid selectors as the primary locator strategy: getByTestId('your-testid')
- Fall back to role-based locators (getByRole, getByLabel, getByText, getByPlaceholder) only when no data-testid is present
- Never use CSS selectors, XPath, or nth-child selectors
- Each instruction must map to exactly one test case
- Include a descriptive test.describe block named after the page
- Each test must be self-contained (no shared state between tests)
- Add brief inline comments explaining non-obvious steps
- Do NOT include any imports other than @playwright/test
- Do NOT wrap output in markdown fences
- Output ONLY the raw TypeScript test file content, nothing else`;

export async function generatePlaywrightTests(
  config: Config,
  snapshot: PageSnapshot,
  instructions: string,
  outputPath: string
): Promise<void> {
  console.log(`[Ollama] Generating Playwright tests from instructions...`);

  const client = new Ollama({ host: config.ollamaHost });

  const truncatedContent = snapshot.content.slice(0, 12_000);

  const userMessage = `Page URL: ${snapshot.url}

--- ACCESSIBILITY SNAPSHOT START ---
${truncatedContent}
--- ACCESSIBILITY SNAPSHOT END ---

--- TEST INSTRUCTIONS START ---
${instructions}
--- TEST INSTRUCTIONS END ---

Generate a complete Playwright TypeScript test file that implements every instruction above.`;

  const response = await client.chat({
    model: config.ollamaModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ],
    options: {
      temperature: 0.1,  // Very low — code output must be deterministic
      num_predict: 4096,
    },
    think: false
  });

  let testCode = response.message.content;

  // Strip markdown fences if the model outputs them despite instructions
  testCode = testCode
    .replace(/^```(?:typescript|ts)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // Normalise to CRLF for Windows
  const finalContent = testCode.replace(/\r?\n/g, "\r\n");

  await writeFile(outputPath, finalContent, "utf-8");
  console.log(`\n[✓] Playwright test file saved to: ${outputPath}`);
  console.log("\n--- GENERATED TEST FILE ---\n");
  console.log(testCode);
}