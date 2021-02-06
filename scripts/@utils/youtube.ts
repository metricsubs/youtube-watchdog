import * as ChildProcess from "child_process";
import * as Path from "path";

import Axios, { AxiosError } from "axios";
import humanize from "human-format";

import { YOUTUBE_API_KEY } from "./env";

const YOUTUBE_API_GATEWAY = "https://www.googleapis.com/youtube/";
const REGEX_FORMAT_HEADER = /format\s+code\s+extension\s+resolution\s+note/i;

export interface LatestVideoData {
  items: {
    id: { videoId: string };
  }[];
}

export async function getLatestVideoIds(channelId: string): Promise<string[]> {
  try {
    let response = await Axios.get<LatestVideoData>(
      `${YOUTUBE_API_GATEWAY}v3/search`,
      {
        params: {
          key: YOUTUBE_API_KEY,
          channelId,
          maxResults: 10,
          order: "date",
          type: "video",
        },
      }
    );

    let data = response.data;

    return data.items.map((item) => item.id.videoId);
  } catch (_error) {
    let error = _error as AxiosError;

    let errorData = error.response?.data?.error;

    if (errorData && "code" in errorData && "message" in errorData) {
      let { message } = errorData;

      throw new Error(message);
    }

    throw new Error(error.message);
  }
}

export interface VideoFormatInfo {
  width: number;
  height: number;
  definition: string;
  bitrate: number;
  codec: string;
  framerate: number;
}

export interface AudioFormatInfo {
  bitrate: number;
  codec: string;
  sampleRate: number;
}

export interface FormatInfo {
  code: number;
  extension: string;
  fileSize: number;
  video?: VideoFormatInfo;
  audio?: AudioFormatInfo;
}

export async function getAvailableFormats(
  videoId: string
): Promise<FormatInfo[]> {
  let videoURL = getYouTubeVideoURL(videoId);

  return new Promise<FormatInfo[]>((resolve, reject) => {
    let childProcess = ChildProcess.exec(
      `youtube-dl -F "${videoURL}"`,
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        let match = stdout.match(REGEX_FORMAT_HEADER);

        if (!match) {
          reject(new Error("No format listed"));
          return;
        }

        let headerText = match[0];
        let headerIndex = match.index as number;

        let formatLines = stdout
          .slice(headerIndex + headerText.length)
          .split("\n");

        let formats: FormatInfo[] = [];

        for (let formatLine of formatLines) {
          formatLine = formatLine.trim();
          if (formatLine.endsWith("(best)")) {
            formatLine = formatLine.slice(0, -6).trim();
          }
          let codeMatches = formatLine.match(/^(\d+)\s+/);
          if (!codeMatches) {
            continue;
          }
          let code = Number(codeMatches[1]);

          let format: FormatInfo | undefined;

          if (formatLine.includes("audio only")) {
            format = parseAudioOnlyFormat(code, formatLine);
          } else if (formatLine.includes("video only")) {
            format = parseVideoOnlyFormat(code, formatLine);
          } else {
            format = parseMixedFormat(code, formatLine);
          }

          if (!format) {
            continue;
          }
          formats.push(format);
          resolve(formats);
        }
      }
    );

    childProcess.stderr?.pipe(process.stderr);
  });
}

function parseAudioOnlyFormat(
  code: number,
  line: string
): FormatInfo | undefined {
  let cols = line.trim().split(",");

  if (cols.length === 4) {
    cols.splice(1, 1);
  }
  if (cols.length !== 3) {
    return undefined;
  }
  let matches = cols[0].match(/^\d+\s+(.*?)\s+audio only\s+(.*?)\s+(\d+k)/i);
  if (!matches) {
    return undefined;
  }
  let extension = matches[1];
  let audio = parseAudioSegment(cols[1]);

  if (!audio) {
    return undefined;
  }

  audio.bitrate = humanize.parse(matches[3]);

  let fileSize = humanize.parse(cols[2].trim());
  return {
    code,
    extension,
    fileSize,
    audio,
  };
}

function parseVideoOnlyFormat(
  code: number,
  line: string
): FormatInfo | undefined {
  let cols = line.trim().split(",");
  if (cols.length === 6) {
    cols.splice(1, 1);
  }
  if (cols.length !== 5) {
    return undefined;
  }
  let videoStart = parseVideoStartSegment(cols[0]);
  if (!videoStart) {
    return undefined;
  }
  let { extension, width, height, definition, bitrate } = videoStart;
  let codec = cols[1].trim();
  let framerate = parseFramerate(cols[2].trim());
  let fileSize = humanize.parse(cols[4].trim());
  return {
    code,
    extension,
    fileSize,
    video: {
      width,
      height,
      definition,
      bitrate,
      codec,
      framerate,
    },
  };
}

function parseMixedFormat(code: number, line: string): FormatInfo | undefined {
  let cols = line.trim().split(",");
  if (cols.length < 4) {
    return undefined;
  }
  let videoStart = parseVideoStartSegment(cols[0]);
  if (!videoStart) {
    return undefined;
  }
  let codec = cols[1].trim();
  let framerate = parseFramerate(cols[2].trim());
  let audio = parseAudioSegment(cols[3]);
  let fileSize = cols.length === 5 ? humanize.parse(cols[4].trim()) : 0;
  if (!audio) {
    return undefined;
  }
  let { extension, width, height, definition, bitrate } = videoStart;
  return {
    code,
    extension,
    fileSize,
    video: {
      width,
      height,
      definition,
      bitrate,
      codec,
      framerate,
    },
    audio,
  };
}

function parseAudioSegment(seg: string): AudioFormatInfo | undefined {
  let matches = seg.trim().match(/^(.*?)\s*\((\d+)Hz\)/);
  if (!matches) {
    return undefined;
  }
  let codec = matches[1];
  let sampleRate = humanize.parse(matches[2]);

  return {
    codec,
    bitrate: 0,
    sampleRate,
  };
}

export interface VideoStartInfo {
  extension: string;
  height: number;
  width: number;
  definition: string;
  bitrate: number;
}

function parseVideoStartSegment(seg: string): VideoStartInfo | undefined {
  let matches = seg
    .trim()
    .match(/^\d+\s+(.*?)\s+(\d+)x(\d+)\s+(.*?)\s+(.*?)$/i);
  if (!matches) {
    return undefined;
  }
  let extension = matches[1];
  let width = Number(matches[2]);
  let height = Number(matches[3]);
  let definition = matches[4];
  let bitrate = humanize.parse(matches[5]) / 1000;
  return {
    extension,
    height,
    width,
    definition,
    bitrate,
  };
}

function parseFramerate(str: string): number {
  str = str.toLowerCase();
  if (str.endsWith("fps")) {
    str = str.slice(0, -3);
  }
  return humanize.parse(str);
}

export function selectBestDownloadFormat(
  formats: FormatInfo[],
  definition: string | number
): DownloadFormat | undefined {
  definition = String(definition).toLowerCase();

  if (!definition.endsWith("p")) {
    definition += "p";
  }

  let audioFormats = formats
    .filter((format) => format.audio && !format.video)
    .sort((a, b) => b.fileSize - a.fileSize) as DownloadAudioOnlyFormat[];

  if (!audioFormats.length) {
    return undefined;
  }

  let audioOnly = audioFormats[0];

  if (audioFormats.length >= 2) {
    let m4aFormats = audioFormats
      .slice(0, 2)
      .filter((format) => format.extension.toLowerCase() === "m4a");
    if (m4aFormats.length) {
      audioOnly = m4aFormats[0];
    }
  }

  let videoFormats = formats
    .filter(
      (format) =>
        format.video &&
        !format.audio &&
        format.video.definition.toLowerCase() === definition
    )
    .sort((a, b) => b.fileSize - a.fileSize) as DownloadVideoOnlyFormat[];

  if (!videoFormats.length) {
    return undefined;
  }

  let videoOnly = videoFormats[0];

  if (videoFormats.length >= 2) {
    let mp4Formats = videoFormats
      .slice(0, 2)
      .filter((format) => format.extension.toLowerCase() === "mp4");
    if (mp4Formats.length) {
      videoOnly = mp4Formats[0];
    }
  }

  return {
    videoOnly,
    audioOnly,
  };
}

export interface DownloadVideoOnlyFormat extends FormatInfo {
  audio: undefined;
  video: VideoFormatInfo;
}

export interface DownloadAudioOnlyFormat extends FormatInfo {
  audio: AudioFormatInfo;
  video: undefined;
}

export interface MergedDownloadFormatOption {
  videoOnly: DownloadVideoOnlyFormat;
  audioOnly: DownloadAudioOnlyFormat;
}

export type DownloadFormat = string | FormatInfo | MergedDownloadFormatOption;

export interface DownloadVideoOptions {
  toDir?: string;
  filenamePattern?: string;
  format?: DownloadFormat;
  writeDescription?: boolean;
  writeAutoSub?: boolean;
  writeThumbnail?: boolean;
  writeInfoJson?: boolean;
}

export interface VideoInfo {
  fulltitle: string;
  title: string;
  description: string;
}

export async function downloadVideo(
  videoId: string,
  options: DownloadVideoOptions = {}
) {
  let {
    toDir = process.execPath,
    format = "best",
    filenamePattern = "%(title)s_%(id)s.%(ext)s",
    writeDescription,
    writeAutoSub,
    writeThumbnail,
    writeInfoJson,
  } = options;

  let outputPath = toDir;

  let videoURL = getYouTubeVideoURL(videoId);

  let commands = ["youtube-dl"];

  if (format) {
    if (typeof format === "object") {
      if ("code" in format) {
        format = String(format.code);
      } else {
        let videoCode = format.videoOnly.code;
        let audioCode = format.audioOnly.code;
        format = `${videoCode}+${audioCode}`;
      }
    }

    commands.push(`-f "${format}"`);
  }
  if (filenamePattern) {
    outputPath = Path.join(outputPath, filenamePattern);
    commands.push(`-o "${outputPath}"`);
  }
  if (writeDescription) {
    commands.push("--write-description");
  }
  if (writeAutoSub) {
    commands.push("--write-auto-sub");
  }
  if (writeThumbnail) {
    commands.push("--write-thumbnail");
  }
  if (writeInfoJson) {
    commands.push("--write-info-json");
  }
  commands.push(videoURL);

  let command = commands.join(" ");

  return new Promise<void>((resolve, reject) => {
    let childProcess = ChildProcess.exec(command, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    childProcess.stdout?.pipe(process.stdout);
    childProcess.stderr?.pipe(process.stderr);
  });
}

export function getYouTubeVideoURL(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeChannelURL(channelId: string) {
  return `https://www.youtube.com/channel/${channelId}`;
}
