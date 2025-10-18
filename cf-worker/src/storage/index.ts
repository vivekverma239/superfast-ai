import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getSignedUrlAws } from "@aws-sdk/s3-request-presigner";

export class Storage {
  private readonly s3: S3Client;
  constructor(
    private readonly bucket: R2Bucket,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucketName: string
  ) {
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  async upload(file: File) {
    return this.bucket.put(file.name, file);
  }

  async download(key: string) {
    // Try downloading via signed url
    try {
      const url = await this.getUrl(key);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${key}`);
      }
      const body = await response.arrayBuffer();
      return new Uint8Array(body);
    } catch (error) {
      // If the signed url fails, try downloading via direct download
      const body = await this.bucket.get(key);
      if (!body) {
        throw new Error(`Failed to download file: ${key}`);
      }
      return new Uint8Array(await body.arrayBuffer());
    }
  }

  async delete(key: string) {
    return this.bucket.delete(key);
  }

  async list(prefix: string) {
    return this.bucket.list({ prefix });
  }

  async getUrl(key: string) {
    return getSignedUrlAws(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
      {
        expiresIn: 60 * 60 * 24,
      }
    );
  }

  async getUploadUrl(key: string) {
    return getSignedUrlAws(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
      {
        expiresIn: 60 * 60 * 24,
      }
    );
  }

  async getCachedObject<T>(key: string): Promise<T | undefined> {
    const cachedObject = await this.bucket.get(`cached-objects/${key}`);
    if (!cachedObject) {
      return undefined;
    }

    // Parse the cached object into json
    try {
      const data: T = JSON.parse(await cachedObject.text());
      return data;
    } catch (error) {
      console.error(`Failed to parse cached object: ${key}`, error);
      // If the cached object is not a valid json, delete it
      return undefined;
    }
  }

  async putCachedObject<T>(key: string, data: T) {
    const json = JSON.stringify(data);
    await this.bucket.put(`cached-objects/${key}`, new Blob([json]));
  }
}
