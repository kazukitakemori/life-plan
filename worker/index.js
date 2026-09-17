import { handleAccountApi } from './accountApi.js';
import { handleAccountEntitlementApi } from './accountEntitlementApi.js';
import { handleLicenseApi } from './licenseApi.js';

export default {
  /**
   * @param {Request} request
   * @param {Record<string, any>} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        const entitlementResponse = await handleAccountEntitlementApi(request, env);
        if (entitlementResponse) return entitlementResponse;

        const accountResponse = await handleAccountApi(request, env);
        if (accountResponse) return accountResponse;

        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
          });
        }

        const response = await handleLicenseApi(request, env);
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch (error) {
        console.error(error);
        return new Response(
          JSON.stringify({
            error: 'INTERNAL_ERROR',
            message: 'サーバーでエラーが発生しました。',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
