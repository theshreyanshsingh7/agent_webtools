import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

let s3ClientInstance: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
};

export const getBucketName = (): string => {
  return config.aws.s3Bucket;
};

const generateRandomId = (): string => {
  return Math.floor(
    1000000000000000 + Math.random() * 9000000000000000
  ).toString();
};

export const uploadImageToS3 = async (
  imageUrl: string,
  searchQuery: string
): Promise<string> => {
  try {
    // Fetch image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Generate unique file name with 16-digit random ID
    const fileExt = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
    const fileName = `searchedImages/${searchQuery.replace(
      /\s+/g,
      "-"
    )}-${generateRandomId()}.${fileExt}`;

    // Upload to S3
    const s3Client = getS3Client();
    const bucketName = getBucketName();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: imageBuffer,
        ContentType: response.headers.get("content-type") || "image/jpeg",
        CacheControl: "max-age=31536000",
      })
    );

    // Return CloudFront URL
    return `https://d1wja1vnncd3ag.cloudfront.net/${fileName}`;
  } catch (error) {
    console.error("Error uploading image to S3:", error);
    // Return original URL if upload fails
    return imageUrl;
  }
};

export const uploadImageBufferToS3 = async (
  screenshot: Buffer,
  searchQuery: string
): Promise<string> => {
  try {
    const fileExt = "png"; // Screenshot is png as per your usage
    const sanitizedQuery = searchQuery.replace(/\s+/g, "-");
    const fileName = `screenshots/${sanitizedQuery}-${generateRandomId()}.${fileExt}`;

    const s3Client = getS3Client();
    const bucketName = getBucketName();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: screenshot,
        ContentType: "image/png",
        CacheControl: "max-age=31536000",
      })
    );

    return `https://d1wja1vnncd3ag.cloudfront.net/${fileName}`;
  } catch (error) {
    console.error("Error uploading image to S3:", error);
    throw new Error("S3 upload failed");
  }
};

export const uploadHTMLToS3 = async (
  html: string,
  searchQuery: string
): Promise<string> => {
  try {
    const sanitizedQuery = searchQuery.replace(/\s+/g, "-");
    const fileName = `searchedHTML/${sanitizedQuery}-${generateRandomId()}`;

    const s3Client = getS3Client();
    const bucketName = getBucketName();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: html,
        ContentType: "text/plain",
        CacheControl: "max-age=31536000",
      })
    );

    return `https://d1wja1vnncd3ag.cloudfront.net/${fileName}`;
  } catch (error) {
    console.error("Error uploading image to S3:", error);
    throw new Error("S3 upload failed");
  }
};
