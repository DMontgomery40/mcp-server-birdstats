#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
    McpError,
    ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join } from "path";

// Core prompt definition that forces proper API usage and data integrity
const PROMPTS = {
    "check-bird": {
        name: "check-bird" as const,
        description: "Analyze bird observations using BirdNET-Pi and eBird data with strict data integrity rules",
        arguments: [
            {
                name: "query",
                description: "User's question about birds they saw/heard",
                required: true
            },
            {
                name: "token",
                description: "BirdWeather station token (pasted in chat)",
                required: false
            }
        ]
    }
};

// Define tools that force proper API usage
const tools = {
    get_birdweather_api: {
        description: "Return the BirdWeather OpenAPI JSON as parsed JSON.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    required: true
                }
            }
        },
        handler: (): unknown => {
            const path = join(__dirname, "birdweather_api.json");
            return JSON.parse(readFileSync(path, "utf8"));
        }
    },
    get_ebird_api: {
        description: "Return the eBird OpenAPI JSON as parsed JSON.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    required: true
                }
            }
        },
        handler: (): unknown => {
            const path = join(__dirname, "ebird_api.json");
            return JSON.parse(readFileSync(path, "utf8"));
        }
    },
    get_system_prompt: {
        description: "Return the system prompt with data integrity rules.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    required: true
                }
            }
        },
        handler: (): string => {
            const path = join(__dirname, "system_prompt.md");
            return readFileSync(path, "utf8");
        }
    }
};

// Initialize the server with required capabilities
const server = new Server(
    {
        name: "mcp-server-birdstats",
        version: "0.1.0"
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {}
        }
    }
);

// Set up tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description
    }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = tools[request.params.name as keyof typeof tools]?.handler;
    if (!handler) {
        throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
        );
    }
    
    const result = await handler();
    return {
        content: [{
            type: "json",
            json: result
        }]
    };
});

// Set up prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: Object.values(PROMPTS)
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== "check-bird") {
        throw new McpError(
            ErrorCode.InvalidRequest,
            `Prompt not found: ${request.params.name}`
        );
    }

    return {
        messages: [
            {
                role: "assistant",
                content: {
                    type: "text",
                    text: `STOP AND READ THESE INSTRUCTIONS:

1. YOU HAVE ACCESS TO:
- BirdWeather API - USE THIS FIRST! No claiming you can't access it.
- eBird API - USE THIS TOO! No claiming you can't access it.
- Web search through @mzxrai/mcp-webresearch as needed

2. DATA RULES - YOU MUST FOLLOW:
- NO example data or estimates
- ONLY use actual API responses
- MUST show percentages for comparisons
- MUST state total observation counts
- If APIs fail, explain exactly which one and why

3. TOKEN HANDLING:
- User will paste token in chat
- DO NOT ask for location - it's in the token
- NEVER ask for environment variables

4. WORKFLOW:
Parse question → Check BirdNET data → Cross-reference eBird → Show percentages → Explain patterns

REQUIRED: Show you understand by checking both APIs and stating observation counts in your response.`
                }
            }
        ]
    };
});

// Run server using stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});