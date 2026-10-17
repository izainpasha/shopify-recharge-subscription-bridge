import {RechargeClient} from './recharge.js';
import {verifyAppProxy, verifyRechargeWebhook} from './signatures.js';

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  },
});

export const createApp = (env = process.env, dependencies = {}) => {
  const recharge = dependencies.recharge || new RechargeClient({
    adminToken: env.RECHARGE_API_TOKEN,
    storefrontToken: env.RECHARGE_STOREFRONT_TOKEN,
    fetchImpl: dependencies.fetchImpl,
  });
  const maxAge = Number(env.MAX_PROXY_AGE_SECONDS || 300);

  const authenticateProxy = (url) => {
    if (!verifyAppProxy(url, env.SHOPIFY_API_SECRET, maxAge)) {
      return {error: json(401, {error: 'invalid_shopify_proxy_signature'})};
    }
    if (url.searchParams.get('shop') !== env.SHOPIFY_STORE_DOMAIN) {
      return {error: json(403, {error: 'unexpected_shop'})};
    }
    const customerId = url.searchParams.get('logged_in_customer_id');
    if (!customerId) return {error: json(401, {error: 'customer_login_required'})};
    return {customerId};
  };

  return async (request) => {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, {ok: true});
    }

    if (request.method === 'GET' && url.pathname === '/eligibility') {
      const auth = authenticateProxy(url);
      if (auth.error) return auth.error;
      return json(200, await recharge.giftEligibility(auth.customerId));
    }

    if (request.method === 'POST' && url.pathname === '/portal/session') {
      const auth = authenticateProxy(url);
      if (auth.error) return auth.error;
      const session = await recharge.createCustomerSession(auth.customerId);
      return session ? json(200, {customer_session: session}) : json(404, {error: 'recharge_customer_not_found'});
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/recharge') {
      const rawBody = await request.text();
      const digest = request.headers.get('x-recharge-hmac-sha256');
      if (!verifyRechargeWebhook(rawBody, digest, env.RECHARGE_CLIENT_SECRET)) {
        return json(401, {error: 'invalid_recharge_webhook_signature'});
      }
      return json(200, {received: true});
    }

    return json(404, {error: 'not_found'});
  };
};
