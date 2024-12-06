# @mcp-get-community/mcp-server-birdstats 

MCP server that provides BirdWeather and BirdNET-Pi and eBird data through natural language query via API endpoints, as well as analysis and data visualization. 

## Features
- Provides `combined_api.json` with all eBird and BirdWeather schemas.
- Provides `system_prompt.md` that the LLM can load as a system message.

## Installation
```json
"mcp-server-birdstats" : {
    "command": "npx",
    "args": ["-y", "mcp-server-birdstats"]
}
