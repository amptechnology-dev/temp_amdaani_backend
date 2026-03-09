import * as yup from 'yup';

// Define environment variable validation schema using yup
const envVarsSchema = yup.object({
  NODE_ENV: yup.string().oneOf(['production', 'development', 'test']).required(),
  PORT: yup.number().default(3000),
  APP_BASE_URL: yup.string().url(),
  MONGODB_URL: yup.string().required('MongoDB URL is required'),
  JWT_SECRET: yup.string().required('JWT secret key is required'),
  JWT_ACCESS_EXPIRATION: yup.string().default('30m'),
  JWT_REFRESH_EXPIRATION: yup.string().default('30d'),
  JWT_REGISTRATION_EXPIRATION_MINUTES: yup.number().default(10),
  COOKIE_SECRET: yup.string().required('Cookie secret key is required'),
  COOKIE_DOMAIN: yup.string(),
  R2_BUCKET_NAME: yup.string().required(),
  R2_PUBLIC_BUCKET_NAME: yup.string().required(),
  R2_ENDPOINT: yup.string().url().required(),
  R2_PUBLIC_ENDPOINT: yup.string().url(),
  R2_ACCESS_KEY_ID: yup.string().required(),
  R2_SECRET_ACCESS_KEY: yup.string().required(),
  PAYU_TEST_MODE: yup.string().default('true'),
  PAYU_KEY: yup.string().required(),
  PAYU_SALT: yup.string().required(),
  // PAYU_REDIRECT_URL: yup.string().required(),
  // PAYU_CANCEL_URL: yup.string().required(),
  // PAYU_SUCCESS_URL: yup.string().required(),
  // PAYU_FAILURE_URL: yup.string().required(),
  // PAYU_WEBHOOK_URL: yup.string().required(),
  // PAYU_MERCHANT_KEY: yup.string().required(),
});

// Validate environment variables
const validateEnv = (schema, env) => {
  try {
    return schema.validateSync(env, { abortEarly: false });
  } catch (error) {
    const errorMessages = error.errors.join(', ');
    throw new Error(`Config validation error: ${errorMessages}`);
  }
};

// Parse and validate environment variables
const envVars = validateEnv(envVarsSchema, process.env);

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  appBaseUrl: envVars.APP_BASE_URL || 'http://localhost:8001',
  mongoose: {
    url: `${envVars.MONGODB_URL}${envVars.NODE_ENV === 'test' ? '-test' : ''}`,
  },
  cors: {
    origin: envVars.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpiration: envVars.JWT_ACCESS_EXPIRATION,
    refreshExpiration: envVars.JWT_REFRESH_EXPIRATION,
    registrationExpiration: envVars.JWT_REGISTRATION_EXPIRATION_MINUTES || 10,
  },
  cookieSecret: envVars.COOKIE_SECRET,
  cookieDomain: envVars.COOKIE_DOMAIN,
  r2: {
    bucketName: envVars.R2_BUCKET_NAME,
    publicBucketName: envVars.R2_PUBLIC_BUCKET_NAME,
    endpoint: envVars.R2_ENDPOINT,
    publicEndpoint: envVars.R2_PUBLIC_ENDPOINT,
    accessKeyId: envVars.R2_ACCESS_KEY_ID,
    secretAccessKey: envVars.R2_SECRET_ACCESS_KEY,
  },
  payu: {
    key: envVars.PAYU_KEY,
    salt: envVars.PAYU_SALT,
    testMode: envVars.PAYU_TEST_MODE === 'true',
  },
};

export default config;
