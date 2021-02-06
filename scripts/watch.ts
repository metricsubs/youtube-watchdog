import * as FS from "fs-extra";
import * as Path from "path";
import { promisify } from "util";

import Axios from "axios";
import _glob from "glob";

import {
  WatchdogChannelMeta,
  WatchdogMeta,
  WatchdogVideoDownloadFileInfo,
  WatchdogVideoMeta,
} from "../index";
import {
  CONFIG_JSON_FILE_PATH,
  PUBLIC_DIR,
  VIDEO_DIR,
  WATCHDOG_META_FILE_PATH,
} from "./@utils/path";
import type { WatchdogChannelInfo, WatchdogConfig } from "./@utils/types";
import * as YouTube from "./@utils/youtube";
import { CI_JOB_ID, CLEAN_SLATE } from "./@utils/env";

const MAX_SAVED_VIDEO_NUM = 10;

const glob = promisify(_glob);

async function main() {
  await initialize();

  let config: WatchdogConfig = await FS.readJSON(CONFIG_JSON_FILE_PATH);

  let metaData = CLEAN_SLATE ? undefined : await getLatestMetaData(config);

  let metaChannels: WatchdogChannelMeta[] = [];

  for (let channelInfo of config.channels) {
    console.info(`Updating channel ${channelInfo.name}(${channelInfo.id})...`);
    let channelMeta = metaData?.channels.find(
      (channelMeta) => channelMeta.id === channelInfo.id
    );

    if (!channelMeta) {
      channelMeta = {
        name: channelInfo.name,
        id: channelInfo.id,
        description: channelInfo.description,
        videos: [],
      };
    }

    let newChannelMeta = await runOnChannelAndGenerateMeta(
      config,
      channelInfo,
      channelMeta
    );

    metaChannels.push(newChannelMeta);
  }

  console.info(`Generating new meta data...`);

  let newMetaData = {
    updatedAt: Date.now(),
    ciJobId: CI_JOB_ID,
    channels: metaChannels,
  };

  await FS.writeFile(
    WATCHDOG_META_FILE_PATH,
    JSON.stringify(newMetaData, undefined, 2)
  );
}

main().catch(console.error);

async function initialize() {
  if (!(await FS.pathExists(PUBLIC_DIR))) {
    await FS.mkdirp(PUBLIC_DIR);
  }
  if (!(await FS.pathExists(VIDEO_DIR))) {
    await FS.mkdirp(VIDEO_DIR);
  }
}

async function getLatestMetaData(
  config: WatchdogConfig
): Promise<WatchdogMeta | undefined> {
  try {
    let response = await Axios.get<WatchdogMeta>(config.metaURL, {
      responseType: "json",
    });

    if (typeof response.data !== "object" || !("channels" in response.data)) {
      `Invalid metadata at '${config.metaURL}'. Treat as empty...`;
      return undefined;
    }

    return response.data;
  } catch (_) {
    console.info(
      `Failed to fetch metadata at '${config.metaURL}'. Using empty one...`
    );

    return undefined;
  }
}

async function runOnChannelAndGenerateMeta(
  config: WatchdogConfig,
  channelInfo: WatchdogChannelInfo,
  originalMetaData: WatchdogChannelMeta
): Promise<WatchdogChannelMeta> {
  console.info(" - Getting latest videos...");
  let videoIds = await YouTube.getLatestVideoIds(channelInfo.id);
  if (!videoIds.length) {
    console.warn(
      `Found no videos under channel ${channelInfo.name}(${channelInfo.id}).`
    );
    return originalMetaData;
  }

  let videoId = videoIds[0];

  console.info(` - Latest video ID: ${videoId}`);

  if (originalMetaData && originalMetaData.latestVideoId === videoId) {
    console.info(
      `Meta under channel ${channelInfo.name} is already the latest.`
    );
    return originalMetaData;
  }

  try {
    let videoMeta = await downloadYouTubeVideo(config, videoId);

    let originalVideos = originalMetaData?.videos ?? [];

    originalVideos = originalVideos.slice(0, MAX_SAVED_VIDEO_NUM - 1);

    return {
      name: channelInfo.name,
      id: channelInfo.id,
      description: channelInfo.description,
      latestVideoId: videoId,
      videos: [videoMeta, ...originalVideos],
    };
  } catch (error) {
    console.error(error);
    return originalMetaData;
  }
}

async function downloadYouTubeVideo(
  config: WatchdogConfig,
  videoId: string
): Promise<WatchdogVideoMeta> {
  console.info(` - Fetching video(${videoId}) available formats...`);
  let formats = await YouTube.getAvailableFormats(videoId);

  let previewFormat = YouTube.selectBestDownloadFormat(formats, "1080p");
  let repoVideoPath = `${config.repoPublicURL}-/jobs/${CI_JOB_ID}/artifacts/raw/video/`;

  let downloads: WatchdogVideoDownloadFileInfo[] = [];

  if (!previewFormat) {
    throw new Error(`No 1080p source available.`);
  }

  console.info(` - Downloading 1080p video...`);

  await YouTube.downloadVideo(videoId, {
    toDir: VIDEO_DIR,
    format: previewFormat,
    writeThumbnail: true,
    writeInfoJson: true,
    writeAutoSub: true,
  });

  console.log("Renaming 1080p resource...");

  {
    let paths = await glob(
      Path.join(VIDEO_DIR, `*_${videoId}.@(mp4|mkv|webm)`)
    );
    if (!paths.length) {
      throw new Error("Downloaded 1080p video file not found");
    }
    let path = paths[0];
    let { dir, name, ext } = Path.parse(path);
    name = name.replace(/ /g, "_");
    let basename = `${name}_1080p${ext}`;
    let newPath = Path.join(dir, basename);
    await FS.rename(path, newPath);
    downloads.push({
      type: "video-1080p",
      url: `${repoVideoPath}${basename}`,
    });
  }
  {
    let paths = await glob(
      Path.join(VIDEO_DIR, `*_${videoId}.@(jpg|jpeg|webp|png)`)
    );
    if (!paths.length) {
      console.warn("Thumbnail not found.");
    } else {
      let path = paths[0];
      let { dir, name, ext } = Path.parse(path);
      name = name.replace(/ /g, "_");
      let basename = `${name}${ext}`;
      let newPath = Path.join(dir, basename);
      await FS.rename(path, newPath);
      downloads.push({
        type: "thumbnail",
        url: `${repoVideoPath}${basename}`,
      });
    }
  }
  {
    let paths = await glob(Path.join(VIDEO_DIR, `*_${videoId}.*.@(vtt|srt)`));
    if (!paths.length) {
      console.warn("Subtitles not found.");
    } else {
      let path = paths[0];
      let { dir, name, ext } = Path.parse(path);
      name = name.replace(/ /g, "_");
      let basename = `${name}${ext}`;
      let newPath = Path.join(dir, basename);
      await FS.rename(path, newPath);
      downloads.push({
        type: "subtitles",
        url: `${repoVideoPath}${basename}`,
      });
    }
  }
  {
    let paths = await glob(Path.join(VIDEO_DIR, `*_${videoId}.info.json`));
    if (!paths.length) {
      console.warn("Video info json not found.");
    } else {
      let path = paths[0];
      let { dir, name, ext } = Path.parse(path);
      name = name.replace(/ /g, "_");
      let basename = `${name}${ext}`;
      let newPath = Path.join(dir, basename);
      await FS.rename(path, newPath);
      downloads.push({
        type: "info",
        url: `${repoVideoPath}${basename}`,
      });
    }
  }

  let maxFormat = YouTube.selectBestDownloadFormat(formats, "2160p");

  if (maxFormat) {
    console.info(` - Downloading 4k video...`);

    await YouTube.downloadVideo(videoId, {
      toDir: VIDEO_DIR,
      format: maxFormat,
    });

    let paths = await glob(
      Path.join(VIDEO_DIR, `*_${videoId}.@(mp4|mkv|webm)`)
    );

    console.info(` - Renaming 4k video...`);

    if (paths.length) {
      let path = paths[0];
      let { dir, name, ext } = Path.parse(path);
      name = name.replace(/ /g, "_");
      let basename = `${name}_4k${ext}`;
      let newPath = Path.join(dir, basename);
      await FS.rename(path, newPath);
      downloads.push({
        type: "video-4k",
        url: `${repoVideoPath}${basename}`,
      });
    }
  } else {
    console.warn(` - 4k video not available.`);
  }

  return { id: videoId, downloads, updatedAt: Date.now() };
}
