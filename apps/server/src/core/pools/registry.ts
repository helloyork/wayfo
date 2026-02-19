import {
  getImagePoolConcurrency,
  getModelPoolConcurrency,
  getPoolMaxRetries,
  getWayfairPoolConcurrency
} from "../config";
import { TaskPool } from "./taskPool";

let wayfairPool: TaskPool | null = null;
let modelPool: TaskPool | null = null;
let imagePool: TaskPool | null = null;
let taxonomyPool: TaskPool | null = null;

export function getWayfairPool() {
  if (!wayfairPool) {
    wayfairPool = new TaskPool({
      name: "wayfair",
      concurrency: getWayfairPoolConcurrency(),
      maxRetries: getPoolMaxRetries()
    });
  }
  return wayfairPool;
}

export function getModelPool() {
  if (!modelPool) {
    modelPool = new TaskPool({
      name: "model",
      concurrency: getModelPoolConcurrency(),
      maxRetries: getPoolMaxRetries()
    });
  }
  return modelPool;
}

export function getImagePool() {
  if (!imagePool) {
    imagePool = new TaskPool({
      name: "image",
      concurrency: getImagePoolConcurrency(),
      maxRetries: getPoolMaxRetries()
    });
  }
  return imagePool;
}

export function getTaxonomyPool() {
  if (!taxonomyPool) {
    taxonomyPool = new TaskPool({
      name: "taxonomy",
      concurrency: Math.max(1, Math.floor(getWayfairPoolConcurrency() / 2)),
      maxRetries: getPoolMaxRetries()
    });
  }
  return taxonomyPool;
}
