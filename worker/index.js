import { handleLicenseApi } from './licenseApi.js';

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string>} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
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

      try {
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
            message: 'ライセンスサーバーでエラーが発生しました。',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            },
          },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
