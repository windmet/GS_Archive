export async function onRequest({ request, next }) {
  const response = await next();
  if (!new URL(request.url).pathname.startsWith('/_app/')) return response;
  if (response.status !== 404 && !/^text\/html\b/i.test(response.headers.get('Content-Type') || '')) return response;
  return new Response(request.method === 'HEAD' ? null : 'Not found', {
    status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
