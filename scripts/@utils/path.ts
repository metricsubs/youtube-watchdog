import * as Path from "path";

export const PROJECT_DIR = Path.join(__dirname, "../..");

export const CONFIG_JSON_FILE_PATH = Path.join(PROJECT_DIR, "watchdog.json");

export const PUBLIC_DIR = Path.join(PROJECT_DIR, "public");

export const WATCHDOG_META_FILE_PATH = Path.join(
  PUBLIC_DIR,
  "watchdog-meta.json"
);

export const VIDEO_DIR = Path.join(PROJECT_DIR, "video");

export const VIDEO_META_TEST_PATH = Path.join(VIDEO_DIR, "test.json");
