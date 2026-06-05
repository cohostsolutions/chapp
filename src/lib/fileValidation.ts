/**
 * File Upload Validation Utilities
 * Prevents malicious files, oversized uploads, and DoS attacks
 * SECURITY: Critical for preventing file-based vulnerabilities
 */

// Allowed MIME types by category
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  document: ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
} as const;

// File size limits in bytes
export const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  document: 50 * 1024 * 1024, // 50MB
  video: 100 * 1024 * 1024, // 100MB
} as const;

// Allowed file extensions (case-insensitive)
export const ALLOWED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  document: ['pdf', 'csv', 'xls', 'xlsx'],
  video: ['mp4', 'mov', 'webm'],
} as const;

// Blocked extensions (executables, scripts, etc.)
export const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr',
  'dll', 'sys', 'msi', 'ps1', 'psm1', 'psc1',
  'app', 'deb', 'rpm', 'dmg', 'pkg',
  'zip', 'rar', '7z', 'tar', 'gz',
  'js', 'ts', 'jsx', 'tsx', 'java', 'py', 'cpp',
  'sh', 'bash', 'zsh',
] as const;

export type FileCategory = keyof typeof FILE_SIZE_LIMITS;

/**
 * Validate a file before upload
 * @param file - File object from input element
 * @param category - File category (image, document, video)
 * @returns Validation result with error message if invalid
 */
export function validateFileUpload(
  file: File,
  category: FileCategory
): { valid: boolean; error?: string } {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  // Get file extension
  const fileNameParts = file.name.split('.');
  const extension = fileNameParts[fileNameParts.length - 1]?.toLowerCase() || '';

  // Check for blocked extensions
  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not allowed. This may be executable code.`,
    };
  }

  // Check file size
  const maxSize = FILE_SIZE_LIMITS[category];
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / 1024 / 1024;
    return {
      valid: false,
      error: `File exceeds maximum size of ${maxSizeMB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
    };
  }

  // Check MIME type
  const allowedMimes = ALLOWED_FILE_TYPES[category] as readonly string[];
  if (!allowedMimes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type || 'unknown'} not allowed for ${category}. Allowed types: ${allowedMimes.join(', ')}`,
    };
  }

  // Check file extension
  const allowedExts = ALLOWED_EXTENSIONS[category] as readonly string[];
  if (!allowedExts.includes(extension)) {
    return {
      valid: false,
      error: `File extension .${extension} not allowed. Allowed extensions: .${allowedExts.join(', .')}`,
    };
  }

  // Additional security: check file name length
  if (file.name.length > 255) {
    return {
      valid: false,
      error: 'File name is too long (max 255 characters)',
    };
  }

  // All checks passed
  return { valid: true };
}

/**
 * Validate multiple files at once
 * @param files - Array of File objects
 * @param category - File category
 * @returns First error found, or null if all valid
 */
export function validateFiles(
  files: File[],
  category: FileCategory
): { valid: boolean; error?: string; invalidFileIndex?: number } {
  for (let i = 0; i < files.length; i++) {
    const result = validateFileUpload(files[i], category);
    if (!result.valid) {
      return {
        valid: false,
        error: `File ${i + 1}: ${result.error}`,
        invalidFileIndex: i,
      };
    }
  }
  return { valid: true };
}

/**
 * Get a user-friendly error message for file upload failures
 * @param error - Error object from upload attempt
 * @returns User-friendly error message
 */
export function getFileUploadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('payload')) {
      return 'File is too large. Please choose a smaller file.';
    }
    if (message.includes('type')) {
      return 'File type is not allowed. Check the accepted formats.';
    }
    if (message.includes('network')) {
      return 'Network error during upload. Please try again.';
    }

    return error.message;
  }

  return 'An error occurred during file upload. Please try again.';
}

/**
 * Create a safe file name by removing potentially malicious characters
 * @param fileName - Original file name
 * @returns Sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path separators and special characters
  let safe = fileName
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
    .trim();

  // Ensure we keep the extension
  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';

  // Limit length
  if (safe.length > 200) {
    safe = safe.substring(0, 200);
  }

  return ext ? `${safe}.${ext}` : safe;
}

/**
 * Check if a file looks suspicious based on magic numbers
 * This is a basic check - proper validation requires server-side verification
 * @param file - File object
 * @returns Promise<boolean> - true if file appears suspicious
 */
export async function checkFileSuspicious(file: File): Promise<boolean> {
  try {
    // Read first few bytes
    const buffer = await file.slice(0, 512).arrayBuffer();
    const view = new Uint8Array(buffer);

    // Check for executable signatures (magic numbers)
    // MZ header (PE/DOS executable)
    if (view[0] === 0x4d && view[1] === 0x5a) {
      return true; // Executable detected
    }

    // ELF header (Unix executable)
    if (view[0] === 0x7f && view[1] === 0x45 && view[2] === 0x4c && view[3] === 0x46) {
      return true;
    }

    // Mach-O header (macOS executable)
    if (
      (view[0] === 0xca && view[1] === 0xfe && view[2] === 0xba && view[3] === 0xbe) ||
      (view[0] === 0xfe && view[1] === 0xed && view[2] === 0xfa && view[3] === 0xce) ||
      (view[0] === 0xfe && view[1] === 0xed && view[2] === 0xfa && view[3] === 0xcf)
    ) {
      return true;
    }

    return false;
  } catch {
    // If we can't read the file, consider it safe to proceed
    // (server-side validation will catch actual issues)
    return false;
  }
}
