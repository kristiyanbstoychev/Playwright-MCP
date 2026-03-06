# Playwright MCP Test Agent

A local AI-powered test automation assistant that uses the [Playwright MCP server](https://hub.docker.com/r/mcp/playwright) and [Ollama](https://ollama.com) to analyse web pages and generate Playwright tests — entirely on your machine, no cloud services required.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                   Your Windows Machine                  │
│                                                         │
│  ┌──────────────────┐      ┌────────────────────────┐  │
│  │  TypeScript MCP  │─────▶│  Playwright MCP Server │  │
│  │  Client (tsx)    │ SSE  │  (Docker: mcp/playwright│  │
│  │                  │◀─────│   port 8931)           │  │
│  └────────┬─────────┘      └────────────────────────┘  │
│           │                                              │
│           │ HTTP                                         │
│           ▼                                              │
│  ┌──────────────────┐                                   │
│  │  Ollama Service  │                                   │
│  │  deepseek-coder  │                                   │
│  │  :6.7b           │                                   │
│  │  (port 11434)    │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

1. The client connects to the Playwright MCP server running in Docker
2. Playwright navigates to the target URL using a headless Chromium browser
3. An accessibility snapshot of the page is captured and sent to Ollama
4. `deepseek-coder:6.7b` generates either a test plan or a runnable test file

---

## Prerequisites

| Requirement | Version | Download |
|---|---|---|
| Windows | 10 22H2+ / 11 | — |
| Docker Desktop | 4.x+ | https://www.docker.com/products/docker-desktop |
| Node.js | 18 LTS+ | https://nodejs.org |
| Ollama | Latest | https://ollama.com/download/windows |

> **Restart your machine after installing Docker Desktop.** It installs a WSL 2 kernel component that requires a reboot to activate.

---

## Installation

### 1. Clone and install dependencies

```powershell
git clone <your-repo-url>
cd playwright-mcp-ts
npm install
```

### 2. Pull the Playwright MCP Docker image

```powershell
docker pull mcp/playwright
```

### 3. Pull the Ollama model

```powershell
ollama pull deepseek-coder:6.7b
```

---

## Starting the Services

Both services must be running before you execute any commands.

### Playwright MCP Server (Docker)

```powershell
docker run -d `
  --name playwright-mcp `
  -p 8931:8931 `
  --init `
  mcp/playwright `
  --headless `
  --no-sandbox `
  --port 8931 `
  --host 0.0.0.0
```

Verify it is running:

```powershell
docker ps
docker logs playwright-mcp
```

### Ollama

Ollama installs as a Windows background service and starts automatically at login. Verify it is reachable:

```powershell
Invoke-WebRequest -Uri http://localhost:11434/api/tags -UseBasicParsing
```

---

## Agents

### Agent 1 — Test Plan (`plan`)

Navigates to a URL, captures the page structure, and generates a human-readable Markdown test plan covering functional test cases, edge cases, and testability recommendations.

**Output:** `test_plan.md` in the current directory.

**Usage:**

```powershell
npm start -- plan <url>
```

**Example:**

```powershell
npm start -- plan https://demo.playwright.dev/todomvc
```

**Example output (`test_plan.md`):**

```markdown
# Test Plan: https://demo.playwright.dev/todomvc

## Page Summary
A TodoMVC application for managing a list of todo items...

## Test Cases

### TC-001 — Add a new todo item
**Objective:** Verify a user can add a new todo item
**Preconditions:** Page is loaded, todo list is empty
**Steps:**
1. Locate the input field using `getByPlaceholder('What needs to be done?')`
2. Call `fill('Buy groceries')`
3. Press `Enter`
**Expected result:** "Buy groceries" appears in the todo list

...
```

---

### Agent 2 — Test Generator (`generate`)

Navigates to a URL, captures the page structure, and generates a complete, ready-to-run Playwright TypeScript test file (`.spec.ts`) based on instructions you provide.

**Output:** A `.spec.ts` file at the path you specify.

**Usage:**

```powershell
npm start -- generate <url> --instructions <instructions.txt> --output <output.spec.ts>
```

| Argument | Required | Description |
|---|---|---|
| `<url>` | Yes | The page to analyse |
| `--instructions` | Yes | Path to a `.txt` file containing test instructions |
| `--output` | Yes | Path where the generated `.spec.ts` file will be saved |

**Step 1 — Write an instructions file**

Create a plain text file with one instruction per line. Each instruction becomes one `test()` block in the generated file.

```
instructions.txt
```
```
Verify the page title is "TodoMVC"
Add a new todo item with the text "Buy groceries"
Mark the "Buy groceries" todo as complete
Delete the "Buy groceries" todo
Verify the footer shows the correct active item count
Filter the list by "Completed" and verify only completed items are shown
```

**Step 2 — Run the generator**

```powershell
npm start -- generate https://demo.playwright.dev/todomvc --instructions instructions.txt --output todo.spec.ts
```

**Step 3 — Run the generated tests**

```powershell
npx playwright test todo.spec.ts
```

**Example output (`todo.spec.ts`):**

```typescript
import { test, expect } from '@playwright/test';

test.describe('TodoMVC', () => {

  test('Verify the page title is "TodoMVC"', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    await expect(page).toHaveTitle(/TodoMVC/);
  });

  test('Add a new todo item with the text "Buy groceries"', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    await page.getByPlaceholder('What needs to be done?').fill('Buy groceries');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listitem')).toContainText('Buy groceries');
  });

  // ... additional tests
});
```

---

## Project Structure

```
playwright-mcp-ts\
├── src\
│   ├── client.ts       ← CLI entry point, mode routing
│   ├── mcp.ts          ← Playwright MCP session (navigate + snapshot)
│   ├── planner.ts      ← Test plan generation via Ollama
│   ├── generator.ts    ← Test file generation via Ollama
│   └── types.ts        ← Shared TypeScript interfaces
├── tsconfig.json
├── package.json
└── README.md
```

---

## Configuration

All service endpoints and the Ollama model are configured at the top of `src/client.ts`:

```typescript
const config: Config = {
  mcpServerUrl: "http://localhost:8931/sse",
  ollamaHost:   "http://localhost:11434",
  ollamaModel:  "deepseek-coder:6.7b",
};
```

To switch models, update `ollamaModel` and pull the replacement:

```powershell
ollama pull qwen2.5-coder:7b
```

---

## Docker Compose (Optional)

For a one-command service startup, use the included Compose file:

```powershell
# Start the Playwright MCP container
docker compose up -d

# Stop it
docker compose down
```

---

## Stopping the Services

```powershell
# Stop and remove the Playwright MCP container
docker stop playwright-mcp
docker rm playwright-mcp

# Ollama runs as a Windows service — no manual stop needed
# To disable it from auto-starting: Settings → Apps → Startup Apps → Ollama
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker: command not found` | Ensure Docker Desktop is running (check system tray) and restart PowerShell |
| Container exits immediately | Verify `--headless` and `--no-sandbox` flags are present in the `docker run` command |
| `ECONNREFUSED` on port 8931 | Run `docker ps` — container may have stopped. Check `docker logs playwright-mcp` |
| `ECONNREFUSED` on port 11434 | Ollama service is not running. Restart it from the system tray or run `ollama serve` |
| Empty snapshot returned | The page may need longer to load — increase the `browser_wait_for_timeout` value in `src/mcp.ts` |
| Poor quality test output | Switch to a stronger model: `ollama pull qwen2.5-coder:7b` and update `config.ollamaModel` |
| WSL 2 error on Docker start | Run PowerShell as Administrator: `wsl --update` then `wsl --set-default-version 2` |