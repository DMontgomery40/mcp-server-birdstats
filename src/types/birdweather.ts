export interface DetectionData {
  species: string;
  confidence: number;
  timestamp: string;
  stationId: string;
}

export interface StationStats {
  totalDetections: number;
  speciesList: string[];
  // Additional type definitions
}
