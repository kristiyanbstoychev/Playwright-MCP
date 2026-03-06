import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { PageSnapshot, Config } from "./types.js";

import EventSource from "eventsource";
(global as unknown as { EventSource: typeof EventSource }).EventSource = EventSource;

export async function capturePageSnapshot(
  config: Config,
  url: string
): Promise<PageSnapshot> {
  const transport = new SSEClientTransport(new URL(config.mcpServerUrl));
  const client = new Client(
    { name: "playwright-test-planner", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("[MCP] Connected to Playwright MCP server.");

  // Discover available tools
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name);
  console.log(`[MCP] Available tools: ${toolNames.join(", ")}\n`);

  // Navigate to the target URL
  console.log(`[MCP] Navigating to: ${url}`);
  await client.callTool({
    name: "browser_navigate",
    arguments: { url },
  });
  console.log("[MCP] Navigation complete.");

  // Wait for dynamic content to settle
  await client.callTool({
    name: "browser_wait_for_timeout",
    arguments: { timeout: 1500 },
  });

  // Capture the accessibility snapshot
  console.log("[MCP] Capturing accessibility snapshot...");
  const snapshotResult = await client.callTool({
    name: "browser_snapshot",
    arguments: {},
  });

  // Extract text from the result content blocks
  const snapshotText = (
    snapshotResult.content as Array<{ type: string; text?: string }>
  )
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!)
    .join("\n");

  await client.close();
  console.log(
    `[MCP] Snapshot captured (${snapshotText.length} chars). Session closed.\n`
  );

  return {
    url,
    content: snapshotText,
    toolsAvailable: toolNames,
  };
}