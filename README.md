# mcp-server-birdstats

> Cross-reference your BirdNET-Pi data with eBird observations using natural language

## Overview

This MCP plugin allows you to analyze BirdNET-Pi/BirdWeather detections by connecting them with eBird's extensive database. It follows the single-file logic structure similar to mcp-webresearch.

## Features

- Natural language interface for querying bird data
- Cross-reference BirdWeather detections with eBird observations
- Analyze detection patterns and highlight unusual birds
- Data-driven visualizations
- Strict data integrity (no example/fake data)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mcp-server-birdstats.git
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

You'll need to set up the following environment variables:
- `BIRDWEATHER_API_TOKEN`: Your BirdWeather API token
- `EBIRD_API_TOKEN`: Your eBird API token

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

## Development

The project uses TypeScript and follows a modular architecture:

```
mcp-server-birdstats/
├── src/
│   └── index.txt        # Core logic in single file
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # Documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Privacy & Security

- Station tokens are never exposed
- Location privacy settings are respected
- User data is handled securely

## Error Handling

The plugin includes robust error handling:
- Graceful API failure handling
- Clear error messages
- Data validation
- Parameter verification

## Performance

Performance considerations:
- Response caching when appropriate
- Request size limits
- Pagination for large datasets

## License

MIT

## Support

For issues and feature requests, please open an issue on the GitHub repository.