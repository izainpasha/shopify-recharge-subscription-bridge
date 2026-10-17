import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const tokenFile = path.join(root, 'RECHARGE_API_TOKEN.env');
const raw = fs.readFileSync(tokenFile, 'utf8');

const values = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const index = line.indexOf('=');
    const value = index >= 0 ? line.slice(index + 1).trim() : line;
    return value.replace(/^['"]|['"]$/g, '');
  })
  .filter((value) => value.length >= 40);

const token = values.sort((a, b) => b.length - a.length)[0];

if (!token) {
  throw new Error('No Recharge token found in RECHARGE_API_TOKEN.env');
}

const headers = {
  'X-Recharge-Access-Token': token,
  'X-Recharge-Version': '2021-11',
  Accept: 'application/json',
};

const get = async (pathname) => {
  const response = await fetch(`https://api.rechargeapps.com${pathname}`, {headers});
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  return JSON.parse(body);
};

const optionalGet = async (pathname, fallbackKey) => {
  try {
    return await get(pathname);
  } catch (error) {
    return {[fallbackKey]: [], error: error.message};
  }
};

const store = await get('/store');
const plans = await get('/plans?limit=250');
const discounts = await optionalGet('/discounts?limit=250', 'discounts');
const webhooks = await optionalGet('/webhooks?limit=250', 'webhooks');
const subscriptions = await optionalGet('/subscriptions?limit=250', 'subscriptions');

const planRows = (plans.plans || []).map((plan) => ({
  id: plan.id,
  title: plan.title,
  external_product_id: plan.external_product_id?.ecommerce || plan.external_product_id,
  channel_checkout: plan.channel_settings?.checkout_page?.display,
  channel_portal: plan.channel_settings?.customer_portal?.display,
  frequencies: (plan.order_interval_frequency_options || []).join(','),
  unit: plan.order_interval_unit,
}));

console.log(JSON.stringify({
  store: {
    id: store.store?.id || store.id,
    name: store.store?.name || store.name,
    currency: store.store?.currency || store.currency,
  },
  counts: {
    plans: (plans.plans || []).length,
    discounts: (discounts.discounts || []).length,
    webhooks: (webhooks.webhooks || []).length,
    subscriptions: (subscriptions.subscriptions || []).length,
  },
  errors: {
    discounts: discounts.error || null,
    webhooks: webhooks.error || null,
    subscriptions: subscriptions.error || null,
  },
  plans: planRows,
}, null, 2));
