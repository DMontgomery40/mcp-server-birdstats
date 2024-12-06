#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tools have no arguments, so empty schemas
const GetSystemPromptSchema = z.object({});
const GetBirdWeatherApiSchema = z.object({});
const GetEbirdApiSchema = z.object({});

const tools = {
  get_system_prompt: {
    description: "Return the content of system_prompt.md as a string.",
    inputSchema: zodToJsonSchema(GetSystemPromptSchema)
  },
  get_birdweather_api: {
    description: "Return the BirdWeather OpenAPI JSON as parsed JSON.",
    inputSchema: zodToJsonSchema(GetBirdWeatherApiSchema)
  },
  get_ebird_api: {
    description: "Return the eBird OpenAPI JSON as parsed JSON.",
    inputSchema: zodToJsonSchema(GetEbirdApiSchema)
  }
};

const server = new Server(
  {
    name: "mcp-server-birdstats",
    capabilities: {
      system_prompt: true,
      birdweather_api: true,
      ebird_api: true,
      tools: true
    },
    version: "0.1.0",
    author: "David Montgomery <https://github.com/DMontgomery40>"
  },
  {
    capabilities: { system_prompt: true, birdweather_api: true, ebird_api: true }
  }
);

function getSystemPrompt(): string {
  const path = join(__dirname, "../system_prompt.md");
  return readFileSync(path, "utf8");
}

function getBirdWeatherApi(): unknown {
  const path = join(__dirname, "../birdweather_api.json");
  const data = readFileSync(path, "utf8");
  return JSON.parse(data);
}

function getEbirdApi(): unknown {
  const path = join(__dirname, "../ebird_api.json");
  const data = readFileSync(path, "utf8");
  return JSON.parse(data);
}

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
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
    case "get_birdweather_api": {
      // Validate empty object
      GetBirdWeatherApiSchema.parse(request.params.arguments);
      const content = getBirdWeatherApi();
      return { content: [{ type: "json", json: content }] };
    }
    case "get_ebird_api": {
      // Validate empty object
      GetEbirdApiSchema.parse(request.params.arguments);
      const content = getEbirdApi();
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
