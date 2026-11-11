import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import type { Readable } from 'node:stream';
import { httpError } from '../lib/http-error';
import { sniffImageType } from '../lib/image-signature';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw httpError('Armazenamento de fotos não está configurado', 503, 'STORAGE_NOT_CONFIGURED');
  }
  return value;
}

let client: S3Client | null = null;

/** Um único cliente S3 por processo (SEC-09): antes, cada foto servida criava um novo. */
function s3() {
  if (!client) {
    client = new S3Client({
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
  return client;
}

export class StorageService {
  /**
   * Grava a foto de perfil. O tipo vem dos bytes do arquivo, não do que o navegador declarou:
   * conteúdo que não é JPEG, PNG, WEBP ou GIF é recusado com 400.
   */
  async uploadAvatar(userId: string, file: { buffer: Buffer }) {
    const type = sniffImageType(file.buffer);
    if (!type) {
      throw httpError('Use uma imagem JPG, PNG, WEBP ou GIF', 400, 'INVALID_IMAGE');
    }

    const key = `avatars/${userId}/${randomUUID()}.${type.ext}`;

    await s3().send(
      new PutObjectCommand({
        Bucket: required('S3_BUCKET'),
        Key: key,
        Body: file.buffer,
        ContentType: type.mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return key;
  }

  async deleteObject(key: string) {
    if (!key) return;
    await s3().send(
      new DeleteObjectCommand({
        Bucket: required('S3_BUCKET'),
        Key: key,
      }),
    );
  }

  /** Abre o arquivo como stream: a foto vai do bucket para a resposta sem passar inteira pela memória. */
  async getObjectStream(key: string) {
    let object;
    try {
      object = await s3().send(
        new GetObjectCommand({
          Bucket: required('S3_BUCKET'),
          Key: key,
        }),
      );
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === 'NoSuchKey' || name === 'NotFound') {
        throw httpError('Arquivo não encontrado', 404);
      }
      throw error;
    }

    if (!object.Body) {
      throw httpError('Arquivo não encontrado', 404);
    }

    return {
      stream: object.Body as Readable,
      contentType: object.ContentType || 'application/octet-stream',
      contentLength: object.ContentLength,
    };
  }
}

export const storageService = new StorageService();
