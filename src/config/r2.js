import { S3Client } from 'bun';
import config from './config.js';

const r2 = new S3Client({
  region: 'auto',
  bucket: config.r2.publicBucketName,
  endpoint: config.r2.endpoint,
  accessKeyId: config.r2.accessKeyId,
  secretAccessKey: config.r2.secretAccessKey,
});

export default r2;
