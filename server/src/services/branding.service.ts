import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { InstitutionSettings } from '../models/InstitutionSettings.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { recordAudit } from '../audit/auditLogger.js';
import { AppError } from '../utils/AppError.js';
import { validateUploadedFile } from '../utils/fileSecurity.js';
import { brandingDir, clearInstitutionProfileCache, getInstitutionProfile } from '../utils/institution.js';
import { ensureDir } from '../tenancy/files.js';
import { requireTenant } from '../tenancy/context.js';

/**
 * The institution's logo. Raster images only (PNG, JPEG, WebP): SVG can carry script and is
 * refused. The file is checked by its signature, renamed by the server and kept in the
 * institution's own branding folder; it is served publicly (sign-in pages need it) at
 * /api/t/<code>/public/logo.
 */

export const LOGO_MAX_BYTES = 512 * 1024;
const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const LOGO_CONTENT_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** Width and height from the image header, so absurd sizes can be refused without decoding. */
function imageSize(buf: Buffer, ext: string): { width: number; height: number } | null {
  if (ext === 'png' && buf.length > 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (ext === 'webp' && buf.length > 30) {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (ext === 'jpg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

export const brandingService = {
  async uploadLogo(file: Express.Multer.File | undefined, adminId: string, req?: Request) {
    if (!file) throw AppError.badRequest('Choose an image file for the logo.');
    const mime = file.mimetype.toLowerCase().trim();
    const ext = LOGO_TYPES[mime];
    if (!ext) throw AppError.badRequest('The logo must be a PNG, JPEG or WebP image. SVG files are not accepted.');
    if (file.size > LOGO_MAX_BYTES) throw AppError.badRequest('The logo can be at most 512 KB.');
    // Signature, extension and type must agree
    validateUploadedFile(file.buffer, file.originalname, mime, LOGO_MAX_BYTES);
    const size = imageSize(file.buffer, ext);
    if (!size || size.width < 32 || size.height < 32 || size.width > 4000 || size.height > 4000) {
      throw AppError.badRequest('The logo must be between 32 and 4000 pixels wide and high.');
    }

    const dir = ensureDir(brandingDir());
    const name = `logo-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(dir, name), file.buffer, { flag: 'wx' });

    const settings = (await InstitutionSettings.findOne()) ?? new InstitutionSettings();
    const previous = settings.logoFile;
    settings.logoFile = name;
    settings.logoUrl = `/api/t/${requireTenant().code}/public/logo?v=${Date.now().toString(36)}`;
    settings.updatedBy = new Types.ObjectId(adminId);
    await settings.save();
    clearInstitutionProfileCache();
    if (previous && previous !== name) fs.rmSync(path.join(dir, path.basename(previous)), { force: true });

    await recordAudit({ action: AUDIT_ACTIONS.INSTITUTION_LOGO_UPDATED, req, details: { adminId, file: name, bytes: file.size, width: size.width, height: size.height } });
    return { logoUrl: settings.logoUrl, width: size.width, height: size.height };
  },

  async removeLogo(adminId: string, req?: Request) {
    const settings = await InstitutionSettings.findOne();
    if (!settings?.logoFile && !settings?.logoUrl) return { logoUrl: '' };
    if (settings.logoFile) fs.rmSync(path.join(brandingDir(), path.basename(settings.logoFile)), { force: true });
    settings.logoFile = undefined;
    settings.logoUrl = '';
    settings.updatedBy = new Types.ObjectId(adminId);
    await settings.save();
    clearInstitutionProfileCache();
    await recordAudit({ action: AUDIT_ACTIONS.INSTITUTION_LOGO_UPDATED, req, details: { adminId, removed: true } });
    return { logoUrl: '' };
  },

  /** Path of the current logo file, or null. */
  async logoPath(): Promise<{ file: string; contentType: string } | null> {
    const { logoFile } = await getInstitutionProfile();
    if (!logoFile) return null;
    const file = path.join(brandingDir(), path.basename(logoFile));
    if (!fs.existsSync(file)) return null;
    const ext = path.extname(file).slice(1).toLowerCase();
    return { file, contentType: LOGO_CONTENT_TYPES[ext] ?? 'application/octet-stream' };
  },
};
