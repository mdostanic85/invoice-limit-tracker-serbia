export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
export const ALLOWED_LOGO_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

export function validateLogoFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const extension = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : "";

  const typeOk =
    ALLOWED_LOGO_TYPES.has(file.type) ||
    (file.type === "" && ALLOWED_LOGO_EXTENSIONS.has(extension));

  if (!typeOk) {
    return "Only PNG and JPEG images are supported.";
  }

  if (file.size > MAX_LOGO_BYTES) {
    return "Logo must be 2 MB or smaller.";
  }

  if (file.size < 32) {
    return "The uploaded file appears to be empty or invalid.";
  }

  return null;
}
