import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const BASE_URL = process.env.WARPMETRICS_API_URL || "https://api.warpmetrics.com";
const apiKey = process.env.WARPMETRICS_API_KEY;

// Handle --list-tools flag
if (process.argv.includes("--list-tools") || process.argv.includes("-l")) {
  listTools().then(() => process.exit(0)).catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
} else if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Warpmetrics MCP Server

Usage: warpmetrics-mcp [options]

Options:
  --list-tools, -l  List all available tools
  --help, -h        Show this help message

Environment:
  WARPMETRICS_API_KEY  (required) Your Warpmetrics API key
  WARPMETRICS_API_URL  API URL (default: https://api.warpmetrics.com)

For more info: https://warpmetrics.com/docs/mcp
`);
  process.exit(0);
} else {
  if (!apiKey) {
    console.error("Error: WARPMETRICS_API_KEY environment variable is required");
    process.exit(1);
  }
}

async function listTools() {
  const response = await fetch(`${BASE_URL}/v1/docs/openapi.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch API spec: ${response.status}`);
  }
  const spec = await response.json();

  console.log("\nWarpmetrics MCP Tools\n");

  // Group by tag (read-only: GET endpoints only)
  const toolsByTag = {};
  for (const [, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation.operationId) continue;
      if (method !== "get") continue;
      const tag = operation.tags?.[0] || "Other";
      if (!toolsByTag[tag]) toolsByTag[tag] = [];
      toolsByTag[tag].push({
        name: operation.operationId,
        summary: operation.summary,
      });
    }
  }

  for (const [tag, tools] of Object.entries(toolsByTag)) {
    console.log(`${tag}`);
    console.log("\u2500".repeat(40));
    for (const tool of tools) {
      console.log(`  ${tool.name}`);
      console.log(`    ${tool.summary}`);
    }
    console.log();
  }

  console.log("Full documentation: https://warpmetrics.com/docs/mcp");
}

/**
 * Fetch OpenAPI spec and generate MCP tools
 */
async function fetchToolsFromAPI() {
  const response = await fetch(`${BASE_URL}/v1/docs/openapi.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }
  const spec = await response.json();
  return generateToolsFromOpenAPI(spec);
}

/**
 * Generate MCP tools from OpenAPI spec
 */
function generateToolsFromOpenAPI(spec) {
  const tools = [];
  const pathMap = {}; // operationId -> { path, parameters }

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const operationId = operation.operationId;
      if (!operationId) continue;

      // Read-only: only expose GET endpoints
      if (method !== "get") continue;

      const properties = {};
      const required = [];

      // Add parameters (path + query)
      if (operation.parameters) {
        for (const param of operation.parameters) {
          properties[param.name] = {
            type: param.schema?.type || "string",
            description: param.description,
            enum: param.schema?.enum,
            default: param.schema?.default,
          };
          if (param.required) {
            required.push(param.name);
          }
        }
      }

      tools.push({
        name: operationId,
        description: `${operation.summary}. ${operation.description || ""}`.trim(),
        inputSchema: {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        },
      });

      pathMap[operationId] = {
        path,
        parameters: operation.parameters || [],
      };
    }
  }

  return { tools, pathMap };
}

/**
 * Execute an API call
 */
async function executeAPICall(pathInfo, args) {
  const { path, parameters } = pathInfo;

  // Build URL with path parameters replaced
  let url = `${BASE_URL}${path}`;
  const queryParams = new URLSearchParams();

  for (const param of parameters) {
    const value = args[param.name];
    if (value === undefined) continue;

    if (param.in === "path") {
      url = url.replace(`{${param.name}}`, encodeURIComponent(value));
    } else if (param.in === "query") {
      queryParams.set(param.name, value);
    }
  }

  const queryString = queryParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!data.success) {
    throw new Error(data.error?.message || `Request failed (${response.status})`);
  }

  return data;
}

/**
 * Format a value based on its field name
 */
const COST_RE = /cost|price|amount/i;
const DURATION_RE = /latency|duration/i;
const RATE_RE = /rate/i;
const SKIP_RE = /^(projectId)$/;

function fmtValue(key, value) {
  if (value == null) return null;
  if (COST_RE.test(key) && typeof value === "number") return `$${value.toFixed(4)}`;
  if (DURATION_RE.test(key) && typeof value === "number") return `${value.toFixed(0)}ms`;
  if (RATE_RE.test(key) && typeof value === "number") return `${value}%`;
  if (typeof value === "number" && value > 9999) return value.toLocaleString();
  return value;
}

/**
 * Format an array of items as a bullet list
 */
function formatArray(items) {
  if (!items.length) return "No results.";
  if (typeof items[0] !== "object") return items.map(i => `\u2022 ${i}`).join("\n");
  return items.map(item => {
    const id = item.id;
    const parts = [];
    for (const [key, value] of Object.entries(item)) {
      if (key === "id" || SKIP_RE.test(key)) continue;
      if (value == null || value === "") continue;
      if (typeof value === "object") continue;
      const formatted = fmtValue(key, value);
      if (formatted != null) parts.push(`${key}: ${formatted}`);
    }
    const detail = parts.join(" | ");
    return id ? `\u2022 ${id} \u2014 ${detail}` : `\u2022 ${detail}`;
  }).join("\n");
}

/**
 * Format an object as readable key-value text
 */
function formatObject(obj, indent = 0) {
  const prefix = "  ".repeat(indent);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_RE.test(key) || value == null) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      lines.push(`${prefix}${key}:`);
      const nested = formatArray(value).split("\n").map(l => `${prefix}  ${l}`).join("\n");
      lines.push(nested);
    } else if (typeof value === "object") {
      lines.push(`${prefix}${key}:`);
      lines.push(formatObject(value, indent + 1));
    } else {
      const formatted = fmtValue(key, value);
      if (formatted != null) lines.push(`${prefix}${key}: ${formatted}`);
    }
  }
  return lines.join("\n");
}

/**
 * Format API response as human-readable text
 */
function formatResponse(response) {
  const data = response.data;
  if (data == null) return "No data.";
  if (Array.isArray(data)) return formatArray(data);
  return formatObject(data);
}

async function main() {
  console.error("Fetching API schema...");
  const { tools, pathMap } = await fetchToolsFromAPI();
  console.error(`Loaded ${tools.length} tools from API`);

  const server = new Server(
    { name: pkg.name, version: pkg.version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const pathInfo = pathMap[name];

    if (!pathInfo) {
      return {
        content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
        isError: true,
      };
    }

    try {
      const response = await executeAPICall(pathInfo, args || {});
      const formatted = formatResponse(response);
      return { content: [{ type: "text", text: formatted }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Warpmetrics MCP server running");
}

// Only run MCP server if not handling CLI flags
if (!process.argv.includes("--list-tools") && !process.argv.includes("-l") &&
    !process.argv.includes("--help") && !process.argv.includes("-h")) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
