import { CryptoHasher } from 'bun';
import config from '../config/config';

const PAYU_KEY = config.payu.key;
const PAYU_SALT = config.payu.salt;

/**
 * Generate PayU request hash
 * @param {Object} params - Payment parameters
 * @param {string} params.txnid - Unique transaction ID
 * @param {string} params.amount - Amount to be charged (2 decimal format as string)
 * @param {string} params.productinfo - Product / Plan name
 * @param {string} params.firstname - Customer first name
 * @param {string} [params.email] - Customer email (optional, fallback added if missing)
 * @param {string} [params.udf1] - Optional user-defined field (e.g. order reference)
 * @param {string} [params.udf2] - Optional user-defined field (e.g. order reference)
 * @param {string} [params.udf3] - Optional user-defined field (e.g. order reference)
 * @returns {string} Hash string (sha512, lowercase)
 */
export function generatePayuHash(params) {
  const safeEmail = params.email || `noemail-${params.txnid}@amptechnology.in`;

  const hashString = `${PAYU_KEY}|${params.txnid}|${params.amount}|${params.productinfo}|${
    params.firstname
  }|${safeEmail}|${params.udf1 || ''}|${params.udf2 || ''}|${params.udf3 || ''}||||||||${PAYU_SALT}`;

  const hasher = new CryptoHasher('sha512');
  return hasher.update(hashString).digest('hex').toLowerCase();
}

function generateResponseHash(params, salt) {
  const { key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, status } = params;
  const hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${(
    amount / 100
  ).toFixed(2)}|${txnid}|${key}`;
  const hasher = new CryptoHasher('sha512');
  return hasher.update(hashString).digest('hex').toLowerCase();
}

/**
 * Build PayU form data object
 * @param {Object} params - Payment parameters
 * @param {string} params.txnid
 * @param {string} params.amount
 * @param {string} params.productinfo
 * @param {string} params.firstname
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @param {string} params.surl - Success URL
 * @param {string} params.furl - Failure URL
 * @param {string} [params.udf1]
 * @param {string} [params.udf2]
 * @param {string} [params.udf3]
 * @returns {Object} Form data to be submitted to PayU
 */
export function buildPayuFormData(params) {
  const hash = generatePayuHash(params);

  return {
    key: PAYU_KEY,
    txnid: params.txnid,
    amount: params.amount,
    productinfo: params.productinfo,
    firstname: params.firstname,
    email: params.email || `noemail-${params.txnid}@amptechnology.in`,
    phone: params.phone || '',
    surl: params.surl,
    furl: params.furl,
    udf1: params.udf1 || '',
    udf2: params.udf2 || '',
    udf3: params.udf3 || '',
    hash,
  };
}

export function validatePayuResponse(params) {
  const hash = generateResponseHash(params, PAYU_SALT);
  return hash === params.hash;
}
