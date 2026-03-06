import { Ollama } from "ollama";
import { writeFile } from "fs/promises";
import { Config, PageSnapshot, TestPlan } from "./types.js";

const SYSTEM_PROMPT = `You are a senior QA engineer specialising in browser automation.
You will be given a structured accessibility snapshot of a web page.
Your task is to produce a detailed Playwright test plan in Markdown format.

The test plan must include:
1. A brief summary of what the page does
2. A list of test cases, each with:
   - Test case ID (TC-001, TC-002, ...)
   - Test objective
   - Preconditions  
   - Step-by-step actions (using Playwright terminology: locator, click, fill, expect, etc.)
   - Expected result
3. Edge cases and negative test scenarios
4. Suggested data-testid attributes to add for better testability (where applicable)

Output only the Markdown test plan. No preamble.`;

export async function generateTestPlan(
  config: Config,
  snapshot: PageSnapshot
): Promise<TestPlan> {
  console.log(`[Ollama] Sending snapshot to ${config.ollamaModel}...`);

  const client = new Ollama({ host: config.ollamaHost });

  // Truncate to stay within deepseek-coder:6.7b's context window
  const truncatedContent = snapshot.content.slice(0, 12_000);

  const userMessage = `Analyse the following accessibility snapshot for the page at: ${snapshot.url}

--- ACCESSIBILITY SNAPSHOT START ---
${truncatedContent}
--- ACCESSIBILITY SNAPSHOT END ---

Generate a comprehensive Playwright test plan for this page.`;

  const response = await client.chat({
    model: config.ollamaModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    options: {
      temperature: 0.1,
      num_predict: 2048,
    },
    think: false
  });

  return { url: snapshot.url, markdown: response.message.content };
}

export async function saveTestPlan(
  plan: TestPlan,
  outputPath: string
): Promise<void> {
  const content = `# Test Plan: ${plan.url}\n\n${plan.markdown}`;
  // Write with CRLF line endings for Windows compatibility
  await writeFile(outputPath, content.replace(/\n/g, "\r\n"), "utf-8");
  console.log(`\n[✓] Test plan saved to: ${outputPath}`);
}