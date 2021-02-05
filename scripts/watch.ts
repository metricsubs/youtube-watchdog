import * as FS from "fs-extra";
import {
  CONFIG_JSON_FILE_PATH,
  PUBLIC_DIR,
  VIDEO_DIR,
  VIDEO_META_TEST_PATH,
  WATCHDOG_META_FILE_PATH,
} from "./@utils/path";
import type { WatchdogConfig } from "./@utils/types";
import * as YouTube from "./@utils/youtube";

async function main() {
  if (!(await FS.pathExists(PUBLIC_DIR))) {
    await FS.mkdirp(PUBLIC_DIR);
  }
  if (!(await FS.pathExists(VIDEO_DIR))) {
    await FS.mkdirp(VIDEO_DIR);
  }

  let config: WatchdogConfig = await FS.readJSON(CONFIG_JSON_FILE_PATH);

  for (let channelInfo of config.channels) {
    let videoIds = await YouTube.getLatestVideoIds(channelInfo.id);

    console.log(videoIds);
  }

  await FS.writeFile(
    WATCHDOG_META_FILE_PATH,
    JSON.stringify({ metaData: "test" }, undefined, 2)
  );

  await FS.writeFile(
    VIDEO_META_TEST_PATH,
    JSON.stringify({ metaData: "test" }, undefined, 2)
  );
}

main().catch(console.error);
