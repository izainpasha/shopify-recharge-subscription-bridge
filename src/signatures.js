import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left || '', 'utf8');
  const rightBuffer = Buffer.from(right || '', 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const appProxyMessage = (searchParams) => {
  const grouped = new Map();

  for (const [key, value] of searchParams) {
    if (key === 'signature') continue;
    const values = grouped.get(key) || [];
    values.push(value);
    grouped.set(key, values);
  }

  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => `${key}=${values.join(',')}`)
    .join('');
};

export const verifyAppProxy = (url, secret, maxAgeSeconds = 300, now = Date.now()) => {
  if (!secret) return false;
  const signature = url.searchParams.get('signature');
  const timestamp = Number(url.searchParams.get('timestamp'));
  if (!signature || !Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > maxAgeSeconds) return false;

  const digest = createHmac('sha256', secret)
    .update(appProxyMessage(url.searchParams))
    .digest('hex');

  return safeEqual(digest, signature);
};

export const verifyRechargeWebhook = (rawBody, receivedDigest, clientSecret) => {
  if (!clientSecret || !receivedDigest) return false;
  const digest = createHash('sha256').update(clientSecret).update(rawBody).digest('hex');
  return safeEqual(digest, receivedDigest);
};
