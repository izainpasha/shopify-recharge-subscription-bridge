const API_ROOT = 'https://api.rechargeapps.com';

export class RechargeClient {
  constructor({adminToken, storefrontToken, fetchImpl = fetch}) {
    if (!adminToken) throw new Error('RECHARGE_API_TOKEN is required');
    this.adminToken = adminToken;
    this.storefrontToken = storefrontToken;
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Recharge-Access-Token': this.adminToken,
        'X-Recharge-Version': '2021-11',
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Recharge request failed with ${response.status}`);
      error.status = response.status;
      error.details = payload;
      throw error;
    }
    return payload;
  }

  async customerByExternalId(customerId) {
    const query = new URLSearchParams({external_customer_id: String(customerId)});
    const payload = await this.request(`/customers?${query}`);
    return payload.customers?.[0] || null;
  }

  async giftEligibility(customerId) {
    const customer = await this.customerByExternalId(customerId);
    if (!customer) return {eligible: true, reason: 'no_recharge_history'};

    const hasHistory = Number(customer.subscriptions_total_count || 0) > 0 ||
      Boolean(customer.first_charge_processed_at);
    return {
      eligible: !hasHistory,
      reason: hasHistory ? 'existing_subscription_history' : 'no_subscription_history',
    };
  }

  async createCustomerSession(customerId) {
    if (!this.storefrontToken) throw new Error('RECHARGE_STOREFRONT_TOKEN is required');
    const customer = await this.customerByExternalId(customerId);
    if (!customer) return null;
    const payload = await this.request(`/customers/${customer.id}/sessions`, {
      method: 'POST',
      body: '{}',
      headers: {'x-recharge-storefront-access-token': this.storefrontToken},
    });
    return payload.customer_session;
  }
}
