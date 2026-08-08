/** Default Docker-style service URLs (http://servicename:port). */
export const SERVICE_URL_DEFAULTS: Record<string, string> = {
  prowlarr: "http://prowlarr:9696",
  nzbhydra2: "http://nzbhydra2:5076",
  jackett: "http://jackett:9117",
  sabnzbd: "http://sabnzbd:8080",
  nzbget: "http://nzbget:6789",
  qbittorrent: "http://qbittorrent:8080",
  transmission: "http://transmission:9091",
  deluge: "http://deluge:8112",
  jellyfin: "http://jellyfin:8096",
  seerr: "http://seerr:5055",
  organizr: "http://organizr:80",
  jfago: "http://jfago:8056",
  sonarr: "http://sonarr:8989",
  radarr: "http://radarr:7878",
  lidarr: "http://lidarr:8686",
};

export function defaultServiceUrl(type: string): string {
  return SERVICE_URL_DEFAULTS[type] ?? `http://${type}:8080`;
}
