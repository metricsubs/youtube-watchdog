export interface WatchdogChannelInfo {
  name: string;
  id: string;
}

export interface WatchdogConfig {
  metaURL: string;
  channels: WatchdogChannelInfo[];
}

export interface WatchdogVideoMeta {
  title: string;
  downloadURL: string;
}

export interface WatchdogChannelMeta {
  name: string;
  id: string;
  videos: WatchdogVideoMeta[];
}

export interface WatchdogMeta {
  channels: WatchdogChannelMeta[];
}
