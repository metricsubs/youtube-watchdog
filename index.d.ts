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
  title: string;
  description: string;
  tags: string[];
  downloads: WatchdogVideoDownloadFileInfo[];
  updatedAt: number;
  ciJobId?: string;
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
  ciJobId?: string;
  channels: WatchdogChannelMeta[];
}
