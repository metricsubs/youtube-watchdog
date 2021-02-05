import * as FS from "fs-extra";
import { PUBLIC_DIR, WATCHDOG_META_FILE_PATH } from "./@utils/path";

async function main() {
  if (!(await FS.pathExists(PUBLIC_DIR))) {
    await FS.mkdirp(PUBLIC_DIR);
  }

  let metaData = {
    channels: [
      {
        name: "TechLinked",
        id: "UCeeFfhMcJa1kjtfZAGskOCA",
        videos: [],
      },
    ],
  };

  await FS.writeFile(WATCHDOG_META_FILE_PATH, JSON.stringify(metaData));
}

main().catch(console.error);
