import axios, { AxiosInstance } from "axios";
import { DetectionData, StationStats } from "../types/birdweather.js";

export class BirdWeatherAPI {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: "https://api.birdweather.com/v1",
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });
  }

  async getDetections(stationId: string): Promise<DetectionData[]> {
    const response = await this.client.get<DetectionData[]>(`/stations/${stationId}/detections`);
    return response.data;
  }

  async getStationStats(stationId: string): Promise<StationStats> {
    const response = await this.client.get<StationStats>(`/stations/${stationId}/stats`);
    return response.data;
  }
}
