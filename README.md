# mcp-server-birdstats

> Cross-reference your BirdNET-Pi data with eBird observations using natural language

## Overview

This MCP plugin allows you to analyze BirdNET-Pi/BirdWeather detections by connecting them with eBird's extensive database. 

## Features

- Natural language interface for querying birdnet-pi / birdweather, and eBird data
- Cross-reference BirdWeather detections with eBird observations
- Data-driven visualizations with React artifacts

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mcp-server-birdstats.git
```

2. Install dependencies:
```bash
npm install
```
## Claude Config
```
"mcp-birdstats": {
      "command": "npx",
      "args": ["-y", "mcp-birdstats"]
    },
```


## Usage

The plugin processes natural language queries about your bird detection data. Example queries:

- "My BirdNET heard a Swainson's Thrush - is that unusual?"
- "What's my station's rarest detection this week?"
- "Graph my detections by time of day"
- "Are others seeing these warblers on eBird?"

## Data Integrity

This plugin strictly adheres to data integrity principles:
- Only uses actual API response data
- Never creates example or estimated data
- Always shows observation counts with percentages
- Clear indication when data is unavailable

## Core Logic

The core functionality is contained in a single text file under `src/index.txt` which includes:
- BirdWeather API interactions
- eBird API interactions
- Data analysis functions
- Type definitions
- Helper utilities

## API Integration

### BirdWeather API
- Station statistics
- Species lists
- Detection records

### eBird API
- Recent observations
- Notable sightings
- Hotspot data
- Species information

## License

MIT

## Support

For issues and feature requests, please open an issue on the GitHub repository.
