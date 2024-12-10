export interface AnalysisResult {
  totalDetections: number;
  totalObservations: number;
  percentages: {
    birdweather: number;
    ebird: number;
  };
  // Additional type definitions
}
