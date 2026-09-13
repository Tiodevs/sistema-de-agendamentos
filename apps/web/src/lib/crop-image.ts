const OUTPUT_SIZE = 512;

export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function fileToObjectUrl(file: File) {
  return URL.createObjectURL(file);
}

export async function remoteImageToObjectUrl(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Não foi possível carregar a foto para recortar');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function cropImageToAvatar(imageSrc: string, pixelCrop: CropPixels) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível recortar a imagem');
  }

  const sourceX = Math.max(0, Math.round(pixelCrop.x));
  const sourceY = Math.max(0, Math.round(pixelCrop.y));
  const sourceWidth = Math.max(
    1,
    Math.min(Math.round(pixelCrop.width), image.naturalWidth - sourceX),
  );
  const sourceHeight = Math.max(
    1,
    Math.min(Math.round(pixelCrop.height), image.naturalHeight - sourceY),
  );

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return canvasToJpeg(canvas);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    image.src = src;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível recortar a imagem'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}
