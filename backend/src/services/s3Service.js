const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const BUCKET = process.env.AWS_S3_BUCKET || 'eldercare-documents';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const UPLOAD_SIGNED_URL_TTL = 3600; // 1 hour
const VIEW_SIGNED_URL_TTL = 3600;   // 1 hour

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined,
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Generate a pre-signed upload URL for direct browser → S3 upload.
 * Returns: { uploadUrl, key, publicUrl }
 */
const getPresignedUploadUrl = async (caregiverId, documentType, mimeType, fileSize) => {
  if (!allowedMimeTypes.includes(mimeType)) {
    throw Object.assign(new Error('Only JPG, PNG, WebP, PDF allowed'), { code: 'INVALID_FILE_TYPE', statusCode: 400 });
  }
  if (fileSize > MAX_FILE_SIZE) {
    throw Object.assign(new Error('File size must be under 10MB'), { code: 'FILE_TOO_LARGE', statusCode: 400 });
  }

  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1];
  const key = `caregivers/${caregiverId}/${documentType}/${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
    Metadata: { caregiverId, documentType, uploadedAt: new Date().toISOString() },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_SIGNED_URL_TTL });
  return { uploadUrl, key, s3Url: `s3://${BUCKET}/${key}` };
};

/**
 * Generate a short-lived signed URL for viewing a private document.
 */
const getSignedViewUrl = async (s3Key) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: VIEW_SIGNED_URL_TTL });
};

/**
 * Generic presigned PUT URL — used for session photos and other non-document uploads.
 */
const getPresignedPutUrl = async (key, mimeType, fileSize) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(mimeType)) {
    throw Object.assign(new Error('Only JPG, PNG, WebP images allowed'), { statusCode: 400 });
  }
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });
  return getSignedUrl(s3, command, { expiresIn: UPLOAD_SIGNED_URL_TTL });
};

/**
 * Delete a document from S3.
 */
const deleteObject = async (s3Key) => {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  } catch (err) {
    logger.error('S3 delete failed', { key: s3Key, error: err.message });
  }
};

module.exports = { getPresignedUploadUrl, getSignedViewUrl, deleteObject, getPresignedPutUrl };
