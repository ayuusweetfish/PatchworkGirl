import { parse as parseYaml } from 'https://deno.land/std@0.160.0/encoding/yaml.ts'

const log = (msg) => console.log(`${(new Date()).toISOString()} ${msg}`)

const cfg = parseYaml(await Deno.readTextFile('config.yml'))

const port = cfg.port || 1026
const server = Deno.listen({ port })
log(`Running at http://localhost:${port}/`)

for await (const conn of server) {
  const httpConn = Deno.serveHttp(conn)
  for await (const evt of httpConn) {
    const req = evt.request
    if (req.headers.get('upgrade') === 'websocket') {
      const { ws, resp } = Deno.upgradeWebSocket(req)
      ws.onopen = () => log('Connected!')
      evt.respondWith(resp)
    } else {
      evt.respondWith(new Response('hi'))
    }
  }
}
