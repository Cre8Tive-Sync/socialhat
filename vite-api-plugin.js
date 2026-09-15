/**
 * Serves the `api/` handlers from the Vite dev server.
 *
 * The handler is written against the Web platform — a `Request` in, a streaming
 * `Response` out — because that is what Vercel Edge, Netlify Functions v2 and
 * Cloudflare Workers all take. Vite's dev server is Connect, which is Node's
 * older `(req, res)`. This is the adapter between the two, and it exists so
 * `npm run dev` exercises the same file production does instead of a mock.
 *
 * Dev only. In production the host runs the files in `api/` itself and never
 * loads this plugin.
 */

/** Mounted routes. The path is `/api/<name>`, served from `api/<name>.js`. */
const ROUTES = ['chat', 'instagram']

export function apiRoutes() {
  return {
    name: 'socialhat-api-routes',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.startsWith('/api/') ? url.pathname.slice(5) : null
        if (!name || !ROUTES.includes(name)) return next()

        try {
          // Loaded through Vite so an edit to api/ is picked up without a
          // restart, the same as anything under src/.
          const mod = await server.ssrLoadModule(`/api/${name}.js`)

          const body =
            req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)

          const response = await mod.default(
            new Request(`http://localhost${req.url}`, {
              method: req.method,
              headers: req.headers,
              body,
            }),
          )

          res.statusCode = response.status
          response.headers.forEach((value, name) => res.setHeader(name, value))

          if (!response.body) return res.end()

          // Written chunk by chunk rather than buffered, or the SSE stream this
          // whole endpoint exists to produce would arrive all at once.
          const reader = response.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
          res.end()
        } catch (error) {
          server.config.logger.error(`[api] ${error.stack ?? error}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(error) }))
        }
      })
    },
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
