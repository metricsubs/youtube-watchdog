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

export type WatchdogVideoDownloadFileType =
  | "info"
  | "thumbnail"
  | "subtitles"
  | "video-1080p"
  | "video-4k";

export interface WatchdogVideoDownloadFileInfo {
  type: WatchdogVideoDownloadFileType;
  url: string;
}

export interface WatchdogVideoMeta {
  id: string;
  downloads: WatchdogVideoDownloadFileInfo[];
  updatedAt: number;
}

export interface WatchdogChannelMeta {
  name: string;
  id: string;
  description?: string;
  latestVideoId?: string;
  videos: WatchdogVideoMeta[];
}

export interface WatchdogMeta {
  updatedAt: number;
  ciJobId: number;
  channels: WatchdogChannelMeta[];
}
