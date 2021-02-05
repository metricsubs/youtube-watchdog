import * as Path from "path";

export const PROJECT_DIR = Path.join(__dirname, "../..");

export const PUBLIC_DIR = Path.join(PROJECT_DIR, "public");

export const WATCHDOG_META_FILE_PATH = Path.join(
  PUBLIC_DIR,
  "watchdog-meta.json"
);
