import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(REPO_ROOT, "dist", "index.js");

function createClient() {
  return new Client({
    name: "birdstats-behavior-tests",
    version: "0.0.1",
  });
}

function assertCommonToolList(listToolsResult) {
  const toolNames = listToolsResult.tools.map((tool) => tool.name).sort();

  assert.deepEqual(toolNames, ["get_birdweather_api", "get_ebird_api", "get_system_prompt"]);

  for (const tool of listToolsResult.tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description && tool.description.length > 20);
  }
}

function assertSuccessToolResult(result, expectedApi) {
  assert.ok(!result.isError, "Expected successful tool result");

  const structured = /** @type {{ status: string; api: string; mode: string; selectedPaths: string[] }} */ (
    result.structuredContent
  );

  assert.equal(structured.status, "ok");
  assert.equal(structured.api, expectedApi);
  assert.equal(structured.mode, "summary");
  assert.ok(Array.isArray(structured.selectedPaths));
}

function assertStructuredFailure(result) {
  assert.equal(result.isError, true);

  const structured = /** @type {{ status: string; retryable: boolean; suggestion: string; message: string }} */ (
    result.structuredContent
  );

  assert.equal(structured.status, "error");
  assert.equal(typeof structured.retryable, "boolean");
  assert.equal(typeof structured.suggestion, "string");
  assert.ok(structured.suggestion.length > 0);
  assert.equal(typeof structured.message, "string");
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address !== "object") {
        server.close(() => reject(new Error("Failed to resolve open port")));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function waitForHttpServerReady(endpoint, attempts = 40, delayMs = 150) {
  let lastStatus = "unreachable";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      lastStatus = String(response.status);

      if (response.status === 405 || response.status === 400) {
        return;
      }
    } catch {
      lastStatus = "unreachable";
    }

    await sleep(delayMs);
  }

  throw new Error(`HTTP server did not become ready in time (last status: ${lastStatus})`);
}

async function closeTransport(transport) {
  try {
    await transport.close();
  } catch {
    // Ignore close errors during test cleanup.
  }
}

async function terminateChildProcess(childProcess) {
  if (childProcess.exitCode !== null) {
    return;
  }

  childProcess.kill("SIGTERM");
  await Promise.race([
    once(childProcess, "exit"),
    sleep(2000).then(() => {
      if (childProcess.exitCode === null) {
        childProcess.kill("SIGKILL");
      }
    }),
  ]);
}

test("stdio transport: initialize, tools/list, tools/call success and failure", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: {
      ...process.env,
      MCP_TRANSPORT: "stdio",
    },
    stderr: "pipe",
  });

  const client = createClient();

  t.after(async () => {
    await closeTransport(transport);
  });

  await client.connect(transport);

  assert.equal(client.getServerVersion()?.name, "mcp-server-birdstats");

  const listedTools = await client.listTools();
  assertCommonToolList(listedTools);

  const success = await client.callTool({
    name: "get_birdweather_api",
    arguments: {
      mode: "summary",
      maxPaths: 3,
    },
  });

  assertSuccessToolResult(success, "birdweather");

  const failure = await client.callTool({
    name: "get_ebird_api",
    arguments: {
      mode: "full",
      confirmLargePayload: false,
    },
  });

  assertStructuredFailure(failure);
});

test("streamable-http transport: initialize, tools/list, tools/call success and failure", async (t) => {
  const port = await getFreePort();
  const endpoint = `http://127.0.0.1:${port}/mcp`;

  const childProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      MCP_TRANSPORT: "streamable-http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_PATH: "/mcp",
      MCP_ALLOWED_ORIGINS: "http://localhost",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderrOutput = "";
  childProcess.stderr?.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  t.after(async () => {
    await terminateChildProcess(childProcess);
  });

  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  const client = createClient();

  t.after(async () => {
    await closeTransport(transport);
  });

  await waitForHttpServerReady(endpoint);
  await client.connect(transport);

  assert.equal(client.getServerVersion()?.name, "mcp-server-birdstats");

  const listedTools = await client.listTools();
  assertCommonToolList(listedTools);

  const success = await client.callTool({
    name: "get_system_prompt",
    arguments: {
      mode: "summary",
      previewLineCount: 4,
    },
  });

  const successPayload = /** @type {{ status: string; mode: string }} */ (success.structuredContent);
  assert.equal(successPayload.status, "ok");
  assert.equal(successPayload.mode, "summary");

  const failure = await client.callTool({
    name: "get_system_prompt",
    arguments: {
      mode: "full",
      confirmLargePayload: false,
    },
  });

  assertStructuredFailure(failure);

  const invalidMethodResponse = await fetch(endpoint, {
    method: "PUT",
  });

  assert.equal(invalidMethodResponse.status, 405);

  const forbiddenOriginResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://malicious.local",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: {
          name: "origin-test-client",
          version: "1.0.0",
        },
      },
    }),
  });

  assert.equal(
    forbiddenOriginResponse.status,
    403,
    `Expected 403 for forbidden origin. stderr: ${stderrOutput}`
  );
});
