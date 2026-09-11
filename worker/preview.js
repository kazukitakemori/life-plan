export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'PREVIEW_API_DISABLED',
          message: 'PRプレビューではライセンスAPIを無効化しています。',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      );
    }

    return env.ASSETS.fetch(request);
  },
};
