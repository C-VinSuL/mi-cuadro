const SUPPORTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

const MIME_TYPES_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf"
};

export const getSupportedDocumentMimeType = (file, allowedTypes = SUPPORTED_FILE_TYPES) => {
  if (!file) return null;
  if (allowedTypes.has(file.type)) return file.type;
  if (file.type && file.type !== "application/octet-stream") return null;

  const extension = file.name?.split(".").pop()?.toLowerCase();
  const mimeType = MIME_TYPES_BY_EXTENSION[extension];
  return allowedTypes.has(mimeType) ? mimeType : null;
};

export const getStorageUploadErrorMessage = (error, formats = "JPG, PNG o PDF") => {
  const statusCode = Number(error?.statusCode || error?.status);
  const message = error?.message || "";

  if (statusCode === 413 || /file size|too large|exceeds.*size/i.test(message)) {
    return "El archivo supera el límite permitido de 5 MB.";
  }
  if (
    statusCode === 401
    || statusCode === 403
    || /row-level security|unauthorized|permission denied/i.test(message)
  ) {
    return "Storage rechazó la carga por permisos. Verifica que tu sesión siga activa, que el MFA esté completado y que la cuenta tenga acceso al archivo.";
  }
  if (statusCode === 415 || /mime type|content type|unsupported media/i.test(message)) {
    return `El formato no está permitido. Usa ${formats} de hasta 5 MB.`;
  }
  return `No se pudo guardar el archivo. Revisa tu conexión y que sea ${formats} de hasta 5 MB.`;
};
