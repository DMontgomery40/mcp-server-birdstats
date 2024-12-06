# @mcp-get-community/mcp-server-birdstats 

MCP server that provides BirdWeather and BirdNET-Pi and eBird data through natural language query via API endpoints, as well as analysis and data visualization. 

## Features
- Provides `birdweather_api.json` and `ebird_api.json` with all eBird and BirdWeather schemas.
- Provides `system_prompt.md` that the LLM can load as a system message.

## Installation for Claude Desktop Config
```json
"mcp-server-birdstats" : {
    "command": "npx",
    "args": ["-y", "mcp-server-birdstats"]
}
