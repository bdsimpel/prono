const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Only allow /event/* paths
    if (!path.startsWith('/event/')) {
      return new Response('Not found', { status: 404 })
    }

    const sofaUrl = `${SOFASCORE_BASE}${path}`
    const res = await fetch(sofaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    })

    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  },
}
