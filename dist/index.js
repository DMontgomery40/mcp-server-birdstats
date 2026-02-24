#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = dirname(__dirname);
const SYSTEM_PROMPT_PATH = join(ROOT_DIR, "system_prompt.md");
const BIRDWEATHER_SPEC_PATH = join(ROOT_DIR, "birdweather_api.json");
const EBIRD_SPEC_PATH = join(ROOT_DIR, "ebird_api.json");
const MCP_SERVER_NAME = "mcp-server-birdstats";
const MCP_SERVER_VERSION = "0.2.0";
const TOOL_MODE_SUMMARY = "summary";
const TOOL_MODE_FULL = "full";
const HTTP_METHODS = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);
function toErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function normalizePath(pathValue) {
    if (!pathValue) {
        return "/mcp";
    }
    return pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
}
function parseCsvEnv(value) {
    if (!value) {
        return new Set();
    }
    const entries = value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    return new Set(entries);
}
function parsePort(value, fallback) {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        throw new Error(`Invalid MCP_HTTP_PORT value: ${value}`);
    }
    return parsed;
}
function readRuntimeConfig() {
    const rawTransport = process.env.MCP_TRANSPORT?.trim().toLowerCase();
    const transport = rawTransport === "streamable-http" || rawTransport === "http"
        ? "streamable-http"
        : "stdio";
    return {
        transport,
        host: process.env.MCP_HTTP_HOST?.trim() || "127.0.0.1",
        port: parsePort(process.env.MCP_HTTP_PORT, 3000),
        path: normalizePath(process.env.MCP_HTTP_PATH?.trim() || "/mcp"),
        allowedOrigins: parseCsvEnv(process.env.MCP_ALLOWED_ORIGINS),
    };
}
function buildToolErrorResult(message, suggestion, retryable, details) {
    return {
        isError: true,
        structuredContent: {
            status: "error",
            retryable,
            suggestion,
            message,
            ...(details ? { details } : {}),
        },
        content: [
            {
                type: "text",
                text: `${message} ${suggestion}`,
            },
        ],
    };
}
function readUtf8File(filePath) {
    return readFileSync(filePath, "utf8");
}
function readJsonFile(filePath) {
    const raw = readUtf8File(filePath);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Expected top-level object in ${filePath}`);
    }
    return parsed;
}
function toObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function summarizeOpenApi(api, sourcePath, spec, maxPaths, pathPrefix) {
    const info = toObject(spec.info);
    const paths = toObject(spec.paths);
    const pathEntries = Object.entries(paths);
    const filteredEntries = pathPrefix
        ? pathEntries.filter(([pathName]) => pathName.startsWith(pathPrefix))
        : pathEntries;
    let operationCount = 0;
    for (const [, operationsValue] of filteredEntries) {
        const operations = toObject(operationsValue);
        operationCount += Object.keys(operations).filter((method) => HTTP_METHODS.has(method.toLowerCase())).length;
    }
    const components = toObject(spec.components);
    const schemas = toObject(components.schemas);
    const tags = Array.isArray(spec.tags) ? spec.tags : [];
    return {
        status: "ok",
        api,
        mode: TOOL_MODE_SUMMARY,
        sourcePath,
        info,
        totals: {
            pathCount: pathEntries.length,
            operationCount,
            schemaCount: Object.keys(schemas).length,
            tagCount: tags.length,
        },
        selectedPaths: filteredEntries.slice(0, maxPaths).map(([pathName]) => pathName),
    };
}
function createApiSpecToolResult(api, sourcePath, mode, confirmLargePayload, maxPaths, pathPrefix) {
    try {
        const spec = readJsonFile(sourcePath);
        const summary = summarizeOpenApi(api, sourcePath, spec, maxPaths, pathPrefix);
        if (mode === TOOL_MODE_FULL && !confirmLargePayload) {
            return buildToolErrorResult("Large payload blocked by default.", "Set confirmLargePayload=true to receive the full OpenAPI document.", true, {
                api,
                expectedMode: TOOL_MODE_FULL,
                currentMode: mode,
            });
        }
        if (mode === TOOL_MODE_FULL) {
            return {
                structuredContent: {
                    ...summary,
                    mode,
                    spec,
                },
                content: [
                    {
                        type: "text",
                        text: `Returned full ${api} OpenAPI spec (${summary.totals.pathCount} paths).`,
                    },
                ],
            };
        }
        return {
            structuredContent: {
                ...summary,
                mode,
            },
            content: [
                {
                    type: "text",
                    text: `Returned ${api} OpenAPI summary with ${summary.selectedPaths.length} path samples.`,
                },
            ],
        };
    }
    catch (error) {
        return buildToolErrorResult(`Failed to load ${api} OpenAPI document: ${toErrorMessage(error)}`, "Verify the repository includes the expected JSON spec file.", false);
    }
}
function createSystemPromptToolResult(mode, confirmLargePayload, previewLineCount) {
    try {
        const promptContent = readUtf8File(SYSTEM_PROMPT_PATH);
        const promptLines = promptContent.split(/\r?\n/);
        const preview = promptLines.slice(0, previewLineCount).join("\n");
        if (mode === TOOL_MODE_FULL && !confirmLargePayload) {
            return buildToolErrorResult("Large payload blocked by default.", "Set confirmLargePayload=true to receive the complete system prompt text.", true, {
                mode,
                previewLineCount,
            });
        }
        if (mode === TOOL_MODE_FULL) {
            return {
                structuredContent: {
                    status: "ok",
                    mode,
                    sourcePath: SYSTEM_PROMPT_PATH,
                    stats: {
                        lineCount: promptLines.length,
                        charCount: promptContent.length,
                    },
                },
                content: [
                    {
                        type: "text",
                        text: promptContent,
                    },
                ],
            };
        }
        return {
            structuredContent: {
                status: "ok",
                mode,
                sourcePath: SYSTEM_PROMPT_PATH,
                stats: {
                    lineCount: promptLines.length,
                    charCount: promptContent.length,
                },
                preview,
            },
            content: [
                {
                    type: "text",
                    text: `Returned prompt summary (${promptLines.length} lines) with ${previewLineCount} preview lines.`,
                },
            ],
        };
    }
    catch (error) {
        return buildToolErrorResult(`Failed to read system prompt: ${toErrorMessage(error)}`, "Verify that system_prompt.md exists at the repository root.", false);
    }
}
function createBirdStatsServer() {
    const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
        description: "Expose BirdWeather/eBird API context and analysis prompt assets for bird observation workflows.",
    }, {
        capabilities: {
            tools: {
                listChanged: false,
            },
            prompts: {
                listChanged: false,
            },
        },
        instructions: "Use summary mode first to minimize token usage. Request full payloads only when required for downstream automation.",
    });
    server.registerTool("get_system_prompt", {
        title: "Read BirdStats System Prompt",
        description: "Use this tool when you need operational instructions for BirdStats analysis behavior. Required inputs: none. Defaults: mode='summary', previewLineCount=12. Set mode='full' with confirmLargePayload=true to return full prompt text. Side effects: none (read-only local file access). Cost note: full mode can consume significant tokens.",
        inputSchema: {
            mode: z.enum([TOOL_MODE_SUMMARY, TOOL_MODE_FULL]).default(TOOL_MODE_SUMMARY),
            confirmLargePayload: z.boolean().default(false),
            previewLineCount: z.number().int().min(1).max(80).default(12),
        },
        annotations: {
            title: "Read BirdStats System Prompt",
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async ({ mode, confirmLargePayload, previewLineCount }) => createSystemPromptToolResult(mode, confirmLargePayload, previewLineCount));
    server.registerTool("get_birdweather_api", {
        title: "Read BirdWeather API Schema",
        description: "Use this tool to inspect the BirdWeather OpenAPI contract used by this server. Required inputs: none. Defaults: mode='summary', maxPaths=25, optional pathPrefix filter. Set mode='full' with confirmLargePayload=true for full schema. Side effects: none (read-only local file access). Cost note: full schema is large; summary is preferred for planning.",
        inputSchema: {
            mode: z.enum([TOOL_MODE_SUMMARY, TOOL_MODE_FULL]).default(TOOL_MODE_SUMMARY),
            confirmLargePayload: z.boolean().default(false),
            maxPaths: z.number().int().min(1).max(200).default(25),
            pathPrefix: z.string().trim().min(1).optional(),
        },
        annotations: {
            title: "Read BirdWeather API Schema",
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async ({ mode, confirmLargePayload, maxPaths, pathPrefix }) => createApiSpecToolResult("birdweather", BIRDWEATHER_SPEC_PATH, mode, confirmLargePayload, maxPaths, pathPrefix));
    server.registerTool("get_ebird_api", {
        title: "Read eBird API Schema",
        description: "Use this tool to inspect the eBird OpenAPI contract used by this server. Required inputs: none. Defaults: mode='summary', maxPaths=25, optional pathPrefix filter. Set mode='full' with confirmLargePayload=true for full schema. Side effects: none (read-only local file access). Cost note: full schema is large; use summary first.",
        inputSchema: {
            mode: z.enum([TOOL_MODE_SUMMARY, TOOL_MODE_FULL]).default(TOOL_MODE_SUMMARY),
            confirmLargePayload: z.boolean().default(false),
            maxPaths: z.number().int().min(1).max(200).default(25),
            pathPrefix: z.string().trim().min(1).optional(),
        },
        annotations: {
            title: "Read eBird API Schema",
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async ({ mode, confirmLargePayload, maxPaths, pathPrefix }) => createApiSpecToolResult("ebird", EBIRD_SPEC_PATH, mode, confirmLargePayload, maxPaths, pathPrefix));
    server.registerPrompt("check-bird", {
        title: "Bird Observation Integrity Workflow",
        description: "Prompt template for strict BirdWeather + eBird analysis. Required argument: query. Optional argument: token for BirdWeather station auth.",
        argsSchema: {
            query: z.string().min(1).describe("User question about detected birds."),
            token: z.string().optional().describe("Optional BirdWeather station token provided in chat."),
        },
    }, async ({ query, token }) => {
        const tokenLine = token
            ? "- BirdWeather token was supplied by the user in chat and should be used directly."
            : "- No BirdWeather token supplied yet; request one only if required for actual API access.";
        return {
            messages: [
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: `STOP AND READ THESE INSTRUCTIONS:\n\n1. YOU HAVE ACCESS TO:\n- BirdWeather API - USE THIS FIRST!\n- eBird API - USE THIS TOO!\n- Web research tools as needed for context\n\n2. DATA RULES - YOU MUST FOLLOW:\n- NO fabricated or estimated values\n- ONLY use actual API responses\n- MUST include percentages for comparisons\n- MUST state total observation counts\n- If APIs fail, explain exactly which one and why\n\n3. TOKEN HANDLING:\n${tokenLine}\n- NEVER ask for environment variables in the chat response\n\n4. WORKFLOW:\nParse question -> Check BirdWeather data -> Cross-reference eBird -> Show percentages -> Explain patterns\n\nUser query: ${query}`,
                    },
                },
            ],
        };
    });
    return server;
}
function toJsonRpcError(code, message) {
    return {
        jsonrpc: "2.0",
        error: {
            code,
            message,
        },
        id: null,
    };
}
function isAllowedOrigin(origin, allowedOrigins) {
    if (!origin) {
        return true;
    }
    if (allowedOrigins.size === 0) {
        return false;
    }
    return allowedOrigins.has(origin);
}
async function startStdioServer() {
    const server = createBirdStatsServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
async function startHttpServer(config) {
    const app = createMcpExpressApp({ host: config.host });
    const sessions = new Map();
    const closeSession = async (sessionId) => {
        const existing = sessions.get(sessionId);
        if (!existing) {
            return;
        }
        sessions.delete(sessionId);
        await Promise.allSettled([existing.server.close(), existing.transport.close()]);
    };
    app.all(config.path, async (req, res) => {
        try {
            if (!isAllowedOrigin(req.headers.origin, config.allowedOrigins)) {
                res.status(403).json(toJsonRpcError(-32000, "Forbidden origin"));
                return;
            }
            if (!["GET", "POST", "DELETE"].includes(req.method)) {
                res.setHeader("Allow", "GET, POST, DELETE");
                res.status(405).json(toJsonRpcError(-32000, `Method not allowed: ${req.method}`));
                return;
            }
            const sessionHeader = req.headers["mcp-session-id"];
            const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
            let session = sessionId ? sessions.get(sessionId) : undefined;
            if (sessionId && !session) {
                res.status(404).json(toJsonRpcError(-32000, "Unknown MCP session ID"));
                return;
            }
            if (!session) {
                if (req.method !== "POST" || !isInitializeRequest(req.body)) {
                    res
                        .status(400)
                        .json(toJsonRpcError(-32000, "Missing active session. Start with initialize over POST."));
                    return;
                }
                const server = createBirdStatsServer();
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (newSessionId) => {
                        sessions.set(newSessionId, { server, transport });
                    },
                    onsessionclosed: async (closedSessionId) => {
                        await closeSession(closedSessionId);
                    },
                });
                await server.connect(transport);
                session = { server, transport };
            }
            await session.transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            const message = toErrorMessage(error);
            console.error("[birdstats] streamable-http request error:", message);
            if (!res.headersSent) {
                res.status(500).json(toJsonRpcError(-32603, "Internal server error"));
            }
        }
    });
    const httpServer = createServer(app);
    await new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(config.port, config.host, () => {
            httpServer.off("error", reject);
            resolve();
        });
    });
    const addressInfo = httpServer.address();
    const resolvedPort = typeof addressInfo === "object" && addressInfo ? addressInfo.port : config.port;
    console.error(`[birdstats] streamable-http listening on http://${config.host}:${resolvedPort}${config.path}`);
    return {
        close: async () => {
            const sessionIds = [...sessions.keys()];
            await Promise.allSettled(sessionIds.map(async (sessionId) => closeSession(sessionId)));
            await new Promise((resolve) => {
                httpServer.close(() => resolve());
            });
        },
    };
}
async function run() {
    const config = readRuntimeConfig();
    if (config.transport === "stdio") {
        await startStdioServer();
        return;
    }
    const runtime = await startHttpServer(config);
    const shutdown = async () => {
        await runtime.close();
        process.exit(0);
    };
    process.once("SIGINT", () => {
        void shutdown();
    });
    process.once("SIGTERM", () => {
        void shutdown();
    });
}
run().catch((error) => {
    console.error("[birdstats] server startup failed:", toErrorMessage(error));
    process.exit(1);
});
//# sourceMappingURL=index.js.map