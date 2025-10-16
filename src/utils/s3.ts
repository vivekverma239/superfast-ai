import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getSignedUrlAws } from "@aws-sdk/s3-request-presigner";

export const getS3 = () => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env
      .CLOUDFLARE_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
    },
  });
};

export const getSignedUrl = async (
  key: string,
  expiresIn: number = 60 * 60 * 24
) => {
  return await getSignedUrlAws(
    getS3(),
    new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_ID!,
      Key: key,
    }),
    {
      expiresIn: expiresIn,
    }
  );
};

export const getSignedUploadUrl = async (
  key: string,
  expiresIn: number = 60 * 60 * 24
) => {
  return await getSignedUrlAws(
    getS3(),
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_ID!,
      Key: key,
    }),
    {
      expiresIn: expiresIn,
    }
  );
};
