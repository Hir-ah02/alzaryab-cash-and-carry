export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (the server enforces the same limit)

export function validateImageFile(file) {
  if (!file) return 'Please choose an image.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Unsupported file type. Please upload a JPG, PNG or WEBP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image is larger than 5 MB. Please choose a smaller file.';
  return '';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be read. Please try another file.'));
    img.src = src;
  });
}

/**
 * Checks the file really is a readable image and returns a local preview
 * URL for it. The original file is what gets uploaded to the server.
 */
export async function loadPreview(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    await loadImage(objectUrl);
    return objectUrl;
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/** Frees a preview URL made by loadPreview (server image URLs are left alone). */
export function releasePreview(src) {
  if (typeof src === 'string' && src.startsWith('blob:')) URL.revokeObjectURL(src);
}
