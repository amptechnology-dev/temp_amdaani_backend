import sharp from 'sharp';
import r2 from '../config/r2.js';
import config from '../config/config.js';
import logger from '../config/logger.js';

/**
 * Compresses and uploads an image to the specified storage.
 * @param {Buffer} fileBuffer - The buffer containing the image data.
 * @param {Object} options - Options for processing the image.
 * @param {boolean} [options.isPublic=false] - Whether to upload the file to the public bucket. Default is false.
 * @param {number} [options.width] - The width to resize the image to.
 * @param {number} [options.height] - The height to resize the image to.
 * @param {number} [options.quality=50] - The quality of the compression. Default is 50.
 * @param {string} [options.format='webp'] - The format to convert the image to. Default is 'webp'.
 * @param {string} [options.fileName] - The name to use for the uploaded file. Default is a UUID.
 * @param {string} [options.folder] - The folder to store the uploaded file in.
 * @returns {Promise<string>} The key of the uploaded file.
 */
export const compressAndUpload = async (fileBuffer, options = {}) => {
  const {
    isPublic = false,
    width,
    height,
    quality = 50,
    format = 'webp',
    fileName = Bun.randomUUIDv7(),
    folder,
  } = options;

  let image = sharp(fileBuffer);
  if (width || height) {
    image = image.resize(width, height);
  }
  const compressedBuffer = await image.toFormat(format, { quality }).toBuffer();
  let key = fileName.endsWith(`.${format}`) ? fileName : `${fileName}.${format}`;
  key = folder ? `${folder}/${key}` : key;

  await r2.write(key, compressedBuffer);
  // const command = new PutObjectCommand({
  //   Bucket: isPublic ? config.r2.publicBucketName : config.r2.bucketName,
  //   Key: key,
  //   Body: compressedBuffer,
  //   ContentType: `image/${format}`,
  // });

  // await r2.send(command);
  return key;
};

export const deleteFileFromR2 = async (publicBucket = false, fileKey) => {
  const bucketName = publicBucket ? config.r2.publicBucketName : config.r2.bucketName;

  try {
    await r2.delete(fileKey);
    logger.info(`File ${fileKey} deleted from ${bucketName}`);
  } catch (error) {
    logger.error(error, 'Error deleting file from R2.');
  }
};
