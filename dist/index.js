#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Tools have no arguments, so empty schemas
const GetSystemPromptSchema = z.object({});
const GetCombinedApiSchema = z.object({});
const tools = {
    get_system_prompt: {
        description: "Return the content of system_prompt.md as a string.",
        inputSchema: zodToJsonSchema(GetSystemPromptSchema)
    },
    get_combined_api: {
        description: "Return the combined OpenAPI JSON as parsed JSON.",
        inputSchema: zodToJsonSchema(GetCombinedApiSchema)
    }
};
const server = new Server({
    name: "@mcp-get-community/mcp-server-birdstats",
    version: "0.1.0",
    author: "Michael Latman <https://michaellatman.com>"
}, {
    capabilities: { tools }
});
function getSystemPrompt() {
    const path = join(__dirname, "../system_prompt.md");
    return readFileSync(path, "utf8");
}
function getCombinedApi() {
    const path = join(__dirname, "../combined_api.json");
    const data = readFileSync(path, "utf8");
    return JSON.parse(data);
}
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!request.params.arguments) {
        throw new Error("Arguments are required");
    }
    switch (request.params.name) {
        case "get_system_prompt": {
            // Validate empty object
            GetSystemPromptSchema.parse(request.params.arguments);
            const content = getSystemPrompt();
            return { content: [{ type: "text", text: content }] };
        }
        case "get_combined_api": {
            // Validate empty object
            GetCombinedApiSchema.parse(request.params.arguments);
            const content = getCombinedApi();
            return { content: [{ type: "json", json: content }] };
        }
        default:
            throw new Error(`Unknown tool: ${request.params.name}`);
    }
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: Object.entries(tools).map(([name, tool]) => ({
            name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }))
    };
});
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
runServer().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
