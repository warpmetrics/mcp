# Warpmetrics MCP Server

Connect AI assistants to your Warpmetrics AI agent telemetry via the [Model Context Protocol](https://modelcontextprotocol.io).

[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io/servers/io.github.warpmetrics/warpmetrics-mcp)
[![npm](https://img.shields.io/npm/v/@warpmetrics/mcp)](https://www.npmjs.com/package/@warpmetrics/mcp)

## Installation

```bash
npm install -g @warpmetrics/mcp
```

## Setup

### 1. Get your API key

Create an API key at [warpmetrics.com/app/api-keys](https://warpmetrics.com/app/api-keys)

### 2. Configure Claude Desktop

Add to your `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "warpmetrics": {
      "command": "warpmetrics-mcp",
      "env": {
        "WARPMETRICS_API_KEY": "wm_live_your_api_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The Warpmetrics tools will now be available.

## Available Tools

Tools are loaded dynamically from the Warpmetrics API and stay automatically in sync.

**View all available tools:**
- Documentation: [warpmetrics.com/docs/mcp](https://warpmetrics.com/docs/mcp)
- CLI: `npx @warpmetrics/mcp --list-tools`

## Example Prompts

### Runs & Calls
- "How many runs did I have today?"
- "Show me the most expensive calls"
- "List recent failed runs"
- "Show details for run wm_run_01abc123"

### Costs & Performance
- "What's my total LLM spend this week?"
- "What's the average latency for my code-review agent?"
- "Show me cost trends for the last 7 days"

### Outcomes & Success Rates
- "What's the success rate for my code-review agent?"
- "Show me outcome statistics"
- "List all outcome classifications"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WARPMETRICS_API_KEY` | Yes | Your Warpmetrics API key |
| `WARPMETRICS_API_URL` | No | API URL (default: https://api.warpmetrics.com) |

## Development

```bash
git clone https://github.com/warpmetrics/mcp.git
cd mcp
npm install

# Run locally
WARPMETRICS_API_KEY=wm_live_... node src/index.js
```

## License

MIT
