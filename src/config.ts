import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { ConfigError } from "./errors.js";

const DEFAULT_CACHE = path.join(process.cwd(), ".gobiz-cache.json");

let envLoaded = false;

export function loadEnv(): NodeJS.ProcessEnv {
  if (!envLoaded) {
    dotenv.config();
    envLoaded = true;
  }
  return process.env;
}

export interface CacheData {
  gopay_token?: string;
  gopay_merchant_id?: string;
  unique_id?: string;
}

export function readCache(cachePath = DEFAULT_CACHE): CacheData {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as CacheData;
    }
  } catch {
  }
  return {};
}

export function writeCache(data: CacheData, cachePath = DEFAULT_CACHE): void {
  try {
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  } catch (e) {
    throw new ConfigError(
      `Failed to save cache to ${cachePath}: ${(e as Error).message}`,
    );
  }
}

export function defaultCachePath(): string {
  return DEFAULT_CACHE;
}
