import dotenv from "dotenv";

dotenv.config();

interface Config {
  port: number;
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    s3Bucket: string;
  };
}

if (
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY ||
  !process.env.AWS_REGION ||
  !process.env.S3_BUCKET
) {
  throw new Error("Missing required AWS environment variables");
}

export const config: Config = {
  port: parseInt(process.env.PORT || "3237", 10),
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.S3_BUCKET,
  },
};
