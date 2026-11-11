export type ImageType = { mime: string; ext: string };

function startsWith(buffer: Buffer, bytes: number[], offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Descobre o tipo da imagem pelos primeiros bytes do arquivo (SEC-09). O tipo que o navegador
 * declara no upload não é confiável: aqui só passa o que realmente é JPEG, PNG, WEBP ou GIF.
 * Devolve `null` para qualquer outro conteúdo.
 */
export function sniffImageType(buffer: Buffer): ImageType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', ext: 'png' };
  }
  // "GIF87a" ou "GIF89a"
  if (
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38]) &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  // "RIFF" <tamanho> "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
