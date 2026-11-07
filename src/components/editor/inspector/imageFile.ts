import { LIMITS } from '@/domain/limits';
import { imageSrcSchema } from '@/domain/schemas/visuals';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Read an uploaded image as a validated inline data URL, or explain why it cannot be used. */
export async function readImageFile(file: File): Promise<{ src: string } | { error: string }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return { error: 'Choose a PNG, JPEG or WebP image.' };
  const src = await readAsDataUrl(file).catch(() => null);
  const parsed = src ? imageSrcSchema.safeParse(src) : null;
  if (!parsed?.success) return { error: `The image is too large or not supported. Use an image under about ${Math.floor((LIMITS.maxImageDataUrlLength * 0.74) / 1024)} KB.` };
  return { src: parsed.data };
}
