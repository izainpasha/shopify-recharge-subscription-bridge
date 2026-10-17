import assert from 'node:assert/strict';
import test from 'node:test';
import {RechargeClient} from '../src/recharge.js';

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {'Content-Type': 'application/json'},
});

test('marks a customer with no Recharge record eligible', async () => {
  const client = new RechargeClient({adminToken: 'token', fetchImpl: async () => response({customers: []})});
  assert.deepEqual(await client.giftEligibility('1'), {eligible: true, reason: 'no_recharge_history'});
});

test('rejects gift eligibility when prior subscription history exists', async () => {
  const client = new RechargeClient({
    adminToken: 'token',
    fetchImpl: async () => response({customers: [{subscriptions_total_count: 1, first_charge_processed_at: null}]}),
  });
  assert.deepEqual(await client.giftEligibility('1'), {eligible: false, reason: 'existing_subscription_history'});
});

test('keeps a Recharge customer without subscription history eligible', async () => {
  const client = new RechargeClient({
    adminToken: 'token',
    fetchImpl: async () => response({customers: [{subscriptions_total_count: 0, first_charge_processed_at: null}]}),
  });
  assert.deepEqual(await client.giftEligibility('1'), {eligible: true, reason: 'no_subscription_history'});
});
