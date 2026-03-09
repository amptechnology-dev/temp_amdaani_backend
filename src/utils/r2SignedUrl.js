import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import r2 from '../config/r2.js';
import config from '../config/config.js';

export const getSignedFileUrl = async (key, expiresIn = 60) => {
  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
  });

  return getSignedUrl(r2, command, { expiresIn });
};
