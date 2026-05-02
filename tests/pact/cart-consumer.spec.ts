/**
 * Pact consumer test — mobile app ↔ Cart Service.
 *
 * Spec ref: §10 contract test. Plan ref: M6 Task 3.
 *
 * Interactions captured:
 *  1. GET /v1/cart (empty) → 200 + empty items.
 *  2. POST /v1/cart/items (add product) → 201 + item record.
 *  3. DELETE /v1/cart/items/:id → 204.
 *
 * Pact file output: pacts/mobile-app-cart-service.json
 */
import { expect } from 'chai';
import axios from 'axios';
import { MatchersV3 } from '@pact-foundation/pact';
import { createPact } from './_helper';

const { like, eachLike, regex } = MatchersV3;

interface CartItem {
  id: string;
  product_id: string;
  qty: number;
  price_cents: number;
}
interface CartResponse {
  user_id: string;
  items: CartItem[];
  total_cents: number;
}

describe('Pact consumer — mobile-app ↔ cart-service', () => {
  const provider = createPact('mobile-app', 'cart-service');

  it('GET /v1/cart (empty) → 200 + empty items', async () => {
    provider
      .given('user has empty cart')
      .uponReceiving('a request for current cart')
      .withRequest({
        method: 'GET',
        path: '/v1/cart',
        headers: { Authorization: regex(/^Bearer\s.+/, 'Bearer eyJ.fake.token') },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          user_id: like('11111111-2222-3333-4444-555555555555'),
          items: [],
          total_cents: like(0),
        },
      });

    await provider.executeTest(async (mock) => {
      const res = await axios.get<CartResponse>(`${mock.url}/v1/cart`, {
        headers: { Authorization: 'Bearer eyJ.fake.token' },
      });
      expect(res.status).to.equal(200);
      expect(res.data.items).to.have.length(0);
      expect(res.data.total_cents).to.equal(0);
    });
  });

  it('POST /v1/cart/items → 201 + new item', async () => {
    provider
      .given('user has empty cart')
      .uponReceiving('add 1 product to cart')
      .withRequest({
        method: 'POST',
        path: '/v1/cart/items',
        headers: {
          Authorization: regex(/^Bearer\s.+/, 'Bearer eyJ.fake.token'),
          'Content-Type': 'application/json',
        },
        body: { product_id: 'PROD_001', qty: 1 },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: like('item_abc123'),
          product_id: like('PROD_001'),
          qty: like(1),
          price_cents: like(2999),
        },
      });

    await provider.executeTest(async (mock) => {
      const res = await axios.post<CartItem>(
        `${mock.url}/v1/cart/items`,
        { product_id: 'PROD_001', qty: 1 },
        {
          headers: {
            Authorization: 'Bearer eyJ.fake.token',
            'Content-Type': 'application/json',
          },
        },
      );
      expect(res.status).to.equal(201);
      expect(res.data.product_id).to.equal('PROD_001');
      expect(res.data.qty).to.equal(1);
      expect(res.data.price_cents).to.be.greaterThan(0);
    });
  });

  it('DELETE /v1/cart/items/:id → 204', async () => {
    provider
      .given('user has 1 item in cart')
      .uponReceiving('remove cart item')
      .withRequest({
        method: 'DELETE',
        path: '/v1/cart/items/item_abc123',
        headers: { Authorization: regex(/^Bearer\s.+/, 'Bearer eyJ.fake.token') },
      })
      .willRespondWith({ status: 204 });

    await provider.executeTest(async (mock) => {
      const res = await axios.delete(`${mock.url}/v1/cart/items/item_abc123`, {
        headers: { Authorization: 'Bearer eyJ.fake.token' },
      });
      expect(res.status).to.equal(204);
    });
  });

  it('GET /v1/cart (with items) → 200 + multiple items', async () => {
    provider
      .given('user has 2 items in cart')
      .uponReceiving('a request for cart with items')
      .withRequest({
        method: 'GET',
        path: '/v1/cart',
        headers: { Authorization: regex(/^Bearer\s.+/, 'Bearer eyJ.fake.token') },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          user_id: like('11111111-2222-3333-4444-555555555555'),
          items: eachLike(
            {
              id: like('item_abc123'),
              product_id: like('PROD_001'),
              qty: like(1),
              price_cents: like(2999),
            },
            1,
          ),
          total_cents: like(2999),
        },
      });

    await provider.executeTest(async (mock) => {
      const res = await axios.get<CartResponse>(`${mock.url}/v1/cart`, {
        headers: { Authorization: 'Bearer eyJ.fake.token' },
      });
      expect(res.status).to.equal(200);
      expect(res.data.items).to.have.length.greaterThan(0);
      expect(res.data.total_cents).to.be.greaterThan(0);
    });
  });
});
