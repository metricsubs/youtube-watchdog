export interface WatchdogChannelInfo {
  name: string;
  id: string;
  description?: string;
}

export interface WatchdogConfig {
  repoPublicURL: string;
  metaURL: string;
  channels: WatchdogChannelInfo[];
}
