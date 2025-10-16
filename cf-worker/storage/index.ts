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
    return this.bucket.get(key);
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
}
