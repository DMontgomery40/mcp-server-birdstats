import axios, { AxiosInstance } from "axios";
import { ObservationData, HotspotData } from "../types/ebird.js";

export class EBirdAPI {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: "https://api.ebird.org/v2",
      headers: {
        "X-eBirdApiToken": apiToken
      }
    });
  }

  async getRecentObservations(location: string): Promise<ObservationData[]> {
    // Placeholder implementation
    return [];
  }

  async getHotspotData(hotspotId: string): Promise<HotspotData> {
    // Placeholder implementation
    return {} as HotspotData;
  }
}
