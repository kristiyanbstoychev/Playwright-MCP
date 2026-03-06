export interface Config {
  mcpServerUrl: string;
  ollamaHost: string;
  ollamaModel: string;
}

export interface PageSnapshot {
  url: string;
  content: string;
  toolsAvailable: string[];
}

export interface TestPlan {
  url: string;
  markdown: string;
}