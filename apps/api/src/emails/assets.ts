import fs from 'node:fs';
import path from 'node:path';
import { assetBaseUrl } from './brand';

export const EMAIL_IMAGES = {
  header: {
    filename: 'leemia-email-header.png',
    contentId: 'leemia-header',
    width: 600,
    height: 338,
  },
  mark: {
    filename: 'leemia-email-mark.png',
    contentId: 'leemia-mark',
    width: 40,
    height: 40,
  },
} as const;

function resolveEmailAsset(filename: string) {
  const candidates = [
    path.join(__dirname, '../../emails/static', filename),
    path.join(process.cwd(), 'emails/static', filename),
    path.join(process.cwd(), 'apps/api/emails/static', filename),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function imageSrc(image: (typeof EMAIL_IMAGES)[keyof typeof EMAIL_IMAGES], useCid: boolean) {
  if (useCid) return `cid:${image.contentId}`;
  return `${assetBaseUrl()}/email/${image.filename}`;
}

export function getInlineAttachments() {
  return Object.values(EMAIL_IMAGES).flatMap((image) => {
    const filePath = resolveEmailAsset(image.filename);
    if (!filePath) return [];

    return [
      {
        filename: image.filename,
        content: fs.readFileSync(filePath),
        contentType: 'image/png',
        contentId: image.contentId,
      },
    ];
  });
}
