import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    const error = new Error('Armazenamento de fotos não está configurado') as Error & {
      statusCode: number;
    };
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function createClient() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: required('S3_ENDPOINT'),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export class StorageService {
  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const ext =
      EXT_BY_MIME[file.mimetype] ||
      path.extname(file.originalname).replace('.', '').toLowerCase() ||
      'jpg';
    const key = `avatars/${userId}/${randomUUID()}.${ext}`;
    const s3 = createClient();

    await s3.send(
      new PutObjectCommand({
        Bucket: required('S3_BUCKET'),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return key;
  }

  async deleteObject(key: string) {
    if (!key) return;
    const s3 = createClient();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: required('S3_BUCKET'),
        Key: key,
      }),
    );
  }

  async getObject(key: string) {
    const s3 = createClient();
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: required('S3_BUCKET'),
        Key: key,
      }),
    );

    if (!object.Body) {
      const error = new Error('Arquivo não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return {
      body: Buffer.from(await object.Body.transformToByteArray()),
      contentType: object.ContentType || 'application/octet-stream',
    };
  }
}

export const storageService = new StorageService();
