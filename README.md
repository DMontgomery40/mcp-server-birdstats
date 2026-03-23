# mcp-server-birdstats

MCP server that exposes BirdWeather and eBird analysis context for code-execution and chat clients.

## What This Server Provides

This server focuses on three read-only tools and one analysis prompt:

- `get_system_prompt`
- `get_birdweather_api`
- `get_ebird_api`
- `check-bird` prompt

The tools are intentionally optimized for low-token defaults:

- Default `mode` is `summary`.
- Full payload access requires `mode="full"` and `confirmLargePayload=true`.
- Tool failures return structured errors (`status`, `retryable`, `suggestion`, `message`) to help clients self-correct.

## Requirements

- Node.js 18+
- npm

## Install

```bash
npm install
npm run build
```

## Run

### stdio (default)

```bash
npm run start
```

or explicitly:

```bash
npm run start:stdio
```

### Streamable HTTP

```bash
MCP_TRANSPORT=streamable-http \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=3000 \
MCP_HTTP_PATH=/mcp \
npm run start
```

Optional hardening:

- `MCP_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1:3000`

If an `Origin` header is present and not allowed, the server returns `403`.

## Docker

Build:

```bash
docker build -t mcp-server-birdstats .
```

Run in stdio mode:

```bash
docker run --rm -it mcp-server-birdstats
```

Run in Streamable HTTP mode:

```bash
docker run --rm -p 3000:3000 \
  -e MCP_TRANSPORT=streamable-http \
  -e MCP_HTTP_HOST=0.0.0.0 \
  -e MCP_HTTP_PORT=3000 \
  -e MCP_HTTP_PATH=/mcp \
  mcp-server-birdstats
```

## Test

```bash
npm test
```

The behavior suite covers:

- initialize lifecycle
- tools/list
- successful tools/call
- failing tools/call with structured error assertions
- both stdio and streamable-http transports

## Provider API Notes

The included `birdweather_api.json` and `ebird_api.json` files are local OpenAPI snapshots consumed by the tools above.

- BirdWeather reference: https://app.birdweather.com/api/v1/docs
- eBird reference hub: https://support.ebird.org/en/support/solutions/articles/48000838205-ebird-api-1-1

## License

MIT

## Appendix: MCP in Practice (Code Execution, Tool Scale, and Safety)

Last updated: 2026-03-23

### Why This Appendix Exists

Model Context Protocol (MCP) is still one of the most useful interoperability layers for tools and agents. The tradeoff is that large MCP servers can expose many tools, and naive tool-calling can flood context windows with schemas, tool chatter, and irrelevant call traces.

In practice, "more tools" is not always "better outcomes." Tool surface area must be paired with execution patterns that keep token use bounded and behavior predictable.

### The Shift to Code Execution / Code Mode

Recent workflows increasingly move complex orchestration out of chat context and into code execution loops. This reduces repetitive schema tokens and makes tool usage auditable and testable.

Core reading:

- [Cloudflare: Code Mode](https://blog.cloudflare.com/code-mode/)
- [Cloudflare: Code Execution with MCP](https://blog.cloudflare.com/code-execution-with-mcp/)
- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)

### Recommended Setup for Power Users

For users who want reproducible and lower-noise MCP usage, start with a codemode-oriented setup:

- [codemode-mcp (jx-codes)](https://github.com/jx-codes/codemode-mcp)
- [UTCP](https://www.utcp.io)

Practical caveat: even with strong setup, model behavior can still be inconsistent across providers and versions. Keep retries, guardrails, and deterministic fallbacks in place.

### Peter Steinberger-Style Wrapper Workflow

A high-leverage pattern is wrapping MCP servers into callable code interfaces and task-focused CLIs instead of exposing every raw tool to the model at all times.

Reference tooling:

- [MCPorter](https://github.com/steipete/mcporter)
- [OpenClaw](https://github.com/steipete/openclaw)

### What Works Best With Which MCP Clients

- Claude Code / Codex / Cursor: strong for direct MCP workflows, but still benefit from narrow tool surfaces.
- Code-execution wrappers (TypeScript/Python CLIs): better when tool count is high or task chains are multi-step.
- Hosted chat clients with weaker MCP controls: often safer via pre-wrapped CLIs or gateway tools.

This ecosystem changes rapidly. If you are reading this now, parts of this guidance may already be out of date.

### Prompt Injection: Risks, Impact, and Mitigations

Prompt injection remains an open security problem for tool-using agents. It is manageable, but not solved.

Primary risks:

- Malicious instructions hidden in tool output or remote content.
- Secret exfiltration and unauthorized external calls.
- Unsafe state changes (destructive file/system/API actions).

Consequences:

- Data leakage, account compromise, financial loss, and integrity failures.

Mitigation baseline:

- Least privilege for credentials and tool scopes.
- Allowlist destinations and enforce egress controls.
- Strict input validation and schema enforcement.
- Human confirmation for destructive/high-risk actions.
- Sandboxed execution with resource/time limits.
- Structured logging, audit trails, and replayable runs.
- Output filtering/redaction before model re-ingestion.

Treat every tool output as untrusted input unless explicitly verified.
