import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  PutBucketLifecycleConfigurationCommand
} from "@aws-sdk/client-s3";
import { getR2Settings } from "../store/settingsStore";
import { getImagePool } from "../pools/registry";
import { log } from "../logger";
import type { ImageType } from "./classifier";

export type UploadedImage = {
  localPath: string;
  type: ImageType;
  key: string;
  publicUrl: string;
  size: number;
  contentType: string;
  hash: string;
};

export type UploadResult = {
  images: UploadedImage[];
  totalSize: number;
  errors: Array<{ localPath: string; error: string }>;
};

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}

function generateFileHash(buffer: Buffer): string {
  return createHash("sha1").update(buffer).digest("hex").slice(0, 16);
}

function buildObjectKey(runId: string, asin: string, type: ImageType, hash: string, ext: string): string {
  return `runs/${runId}/${asin}/${type}/${hash}${ext}`;
}

function createR2Client(): { client: S3Client; bucketName: string; publicUrlBase: string } {
  const settings = getR2Settings();
  if (!settings) {
    throw new Error("R2 settings not configured");
  }

  const client = new S3Client({
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey
    },
    region: "auto"
  });

  return {
    client,
    bucketName: settings.bucketName,
    publicUrlBase: settings.publicUrlBase.replace(/\/$/, "")
  };
}

async function uploadSingleImage(input: {
  client: S3Client;
  bucketName: string;
  publicUrlBase: string;
  localPath: string;
  type: ImageType;
  runId: string;
  asin: string;
}): Promise<UploadedImage> {
  const { client, bucketName, publicUrlBase, localPath, type, runId, asin } = input;

  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }

  const buffer = fs.readFileSync(localPath);
  const hash = generateFileHash(buffer);
  const ext = path.extname(localPath).toLowerCase() || ".png";
  const contentType = getContentType(localPath);
  const key = buildObjectKey(runId, asin, type, hash, ext);

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=604800"
    })
  );

  const publicUrl = `${publicUrlBase}/${key}`;

  return {
    localPath,
    type,
    key,
    publicUrl,
    size: buffer.length,
    contentType,
    hash
  };
}

export async function uploadImagesToR2(input: {
  runId: string;
  asin: string;
  images: Array<{
    localPath: string;
    type: ImageType;
  }>;
}): Promise<UploadResult> {
  if (input.images.length === 0) {
    return { images: [], totalSize: 0, errors: [] };
  }

  const { client, bucketName, publicUrlBase } = createR2Client();
  const pool = getImagePool();

  const results: UploadedImage[] = [];
  const errors: Array<{ localPath: string; error: string }> = [];
  let totalSize = 0;

  const taskResults = await pool.run(input.images, async (image) => {
    try {
      const result = await uploadSingleImage({
        client,
        bucketName,
        publicUrlBase,
        localPath: image.localPath,
        type: image.type,
        runId: input.runId,
        asin: input.asin
      });
      return { success: true as const, result };
    } catch (error) {
      log({
        level: "warn",
        runId: input.runId,
        message: "R2 upload failed",
        err: { localPath: image.localPath, error: String(error) }
      });
      return {
        success: false as const,
        error: {
          localPath: image.localPath,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  });

  for (const taskResult of taskResults) {
    if (taskResult.success) {
      results.push(taskResult.result);
      totalSize += taskResult.result.size;
    } else {
      errors.push(taskResult.error);
    }
  }

  return { images: results, totalSize, errors };
}

export async function uploadGeneratedImages(input: {
  runId: string;
  generatedImages: Map<string, Array<{
    generatedPath: string;
    type: ImageType;
  }>>;
}): Promise<{
  uploaded: Map<string, UploadedImage[]>;
  totalSize: number;
  errors: Array<{ asin: string; localPath: string; error: string }>;
}> {
  const uploaded = new Map<string, UploadedImage[]>();
  const allErrors: Array<{ asin: string; localPath: string; error: string }> = [];
  let totalSize = 0;

  for (const [asin, images] of input.generatedImages) {
    const result = await uploadImagesToR2({
      runId: input.runId,
      asin,
      images: images.map((img) => ({
        localPath: img.generatedPath,
        type: img.type
      }))
    });

    uploaded.set(asin, result.images);
    totalSize += result.totalSize;

    for (const error of result.errors) {
      allErrors.push({ asin, ...error });
    }
  }

  return { uploaded, totalSize, errors: allErrors };
}

export async function configureR2LifecycleRules(days: number): Promise<void> {
  const { client, bucketName } = createR2Client();

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "wayfo-runs-expiration",
            Status: "Enabled",
            Filter: { Prefix: "runs/" },
            Expiration: { Days: days }
          }
        ]
      }
    })
  );
}

export function buildImageUrlsForSubmit(input: {
  mainAsin: string;
  asin: string;
  uploadedImages: Map<string, UploadedImage[]>;
  isMain: boolean;
}): string[] {
  const urls: string[] = [];
  const asinImages = input.uploadedImages.get(input.asin) ?? [];

  const primaryImages = asinImages.filter((img) => img.type === "primary");
  if (primaryImages.length === 0) {
    return [];
  }
  urls.push(primaryImages[0].publicUrl);

  if (input.isMain) {
    const sharedImages = asinImages.filter((img) => img.type !== "primary");
    for (const img of sharedImages) {
      urls.push(img.publicUrl);
    }
  } else {
    const mainImages = input.uploadedImages.get(input.mainAsin) ?? [];
    const sharedFromMain = mainImages.filter((img) => img.type !== "primary");
    for (const img of sharedFromMain) {
      urls.push(img.publicUrl);
    }
  }

  return urls;
}
