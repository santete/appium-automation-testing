/**
 * Pact consumer test — mobile app ↔ Auth Service.
 *
 * Spec ref: §10 contract test. Plan ref: M6 Task 3, Decision 2 (consumer owned
 * by mobile; provider verification deferred).
 *
 * Interactions captured:
 *  1. POST /v1/auth/login (valid creds) → 200 + token + user.
 *  2. POST /v1/auth/login (invalid creds) → 401 + error code.
 *  3. POST /v1/auth/refresh (valid refresh token) → 200 + new token.
 *
 * Pact file output: pacts/mobile-app-auth-service.json
 */
import { expect } from 'chai';
import axios from 'axios';
import { MatchersV3 } from '@pact-foundation/pact';
import { createPact } from './_helper';

const { like, regex, eachLike } = MatchersV3;

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; roles: string[] };
}

describe('Pact consumer — mobile-app ↔ auth-service', () => {
  const provider = createPact('mobile-app', 'auth-service');

  it('POST /v1/auth/login (valid) → 200 + token + user', async () => {
    provider
      .given('a registered user standard@example.com exists')
      .uponReceiving('a valid login request')
      .withRequest({
        method: 'POST',
        path: '/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'standard@example.com', password: 'secret_sauce' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          access_token: regex(/^[A-Za-z0-9._-]+$/, 'eyJhbGciOi.fake.token'),
          refresh_token: like('rt_abcdef123456'),
          user: {
            id: regex(/^[a-f0-9-]+$/, '11111111-2222-3333-4444-555555555555'),
            email: like('standard@example.com'),
            roles: eachLike('standard', 1),
          },
        },
      });

    await provider.executeTest(async (mock) => {
      const res = await axios.post<LoginResponse>(
        `${mock.url}/v1/auth/login`,
        { email: 'standard@example.com', password: 'secret_sauce' },
        { headers: { 'Content-Type': 'application/json' } },
      );
      expect(res.status).to.equal(200);
      expect(res.data.access_token).to.be.a('string');
      expect(res.data.user.email).to.equal('standard@example.com');
      expect(res.data.user.roles).to.have.length.greaterThan(0);
    });
  });

  it('POST /v1/auth/login (invalid) → 401 + error code', async () => {
    provider
      .given('user not registered')
      .uponReceiving('an invalid login request')
      .withRequest({
        method: 'POST',
        path: '/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'locked@example.com', password: 'wrong' },
      })
      .willRespondWith({
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'invalid_credentials', message: like('email or password incorrect') },
      });

    await provider.executeTest(async (mock) => {
      const res = await axios.post(
        `${mock.url}/v1/auth/login`,
        { email: 'locked@example.com', password: 'wrong' },
        {
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true,
        },
      );
      expect(res.status).to.equal(401);
      expect((res.data as { error: string }).error).to.equal('invalid_credentials');
    });
  });

  it('POST /v1/auth/refresh → 200 + new access token', async () => {
    provider
      .given('a valid refresh token exists')
      .uponReceiving('a token refresh request')
      .withRequest({
        method: 'POST',
        path: '/v1/auth/refresh',
        headers: { 'Content-Type': 'application/json' },
        body: { refresh_token: 'rt_abcdef123456' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          access_token: like('new.access.token'),
          expires_in: like(3600),
        },
      });

    await provider.executeTest(async (mock) => {
      const res = await axios.post(
        `${mock.url}/v1/auth/refresh`,
        { refresh_token: 'rt_abcdef123456' },
        { headers: { 'Content-Type': 'application/json' } },
      );
      expect(res.status).to.equal(200);
      expect((res.data as { access_token: string }).access_token).to.be.a('string');
    });
  });
});
