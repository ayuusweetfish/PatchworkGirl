import { parse as parseYaml } from 'https://deno.land/std@0.160.0/encoding/yaml.ts'

const log = (msg) => console.log(`${(new Date()).toISOString()} ${msg}`)

const cfg = parseYaml(await Deno.readTextFile('config.yml'))

const indexHtml = await Deno.readTextFile('index.html')

const port = cfg.port || 1026
const server = Deno.listen({ port })
log(`Running at http://localhost:${port}/`)

const socketsAdmin = {}
const socketsAgent = {}

const adminBroadcast = (obj) => {
  const str = JSON.stringify(obj)
  for (const socket of Object.values(socketsAdmin)) socket.send(str)
}

const serveReq = async (req) => {
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req)
    const path = (new URL(req.url)).pathname
    const isAdmin = (path === '/admin')
    const clientId = Date.now()
    socket.onopen = () => {
      log(`${isAdmin ? 'Admin' : 'Agent'} connected`)
      socket.send(JSON.stringify({ id: clientId }))
      if (isAdmin) {
        socketsAdmin[clientId] = socket
        for (const agentClientId of Object.keys(socketsAgent))
          socket.send(JSON.stringify({ type: 'agent-on', id: agentClientId }))
      } else {
        socketsAgent[clientId] = socket
        adminBroadcast({ type: 'agent-on', id: clientId })
      }
    }
    socket.onclose = () => {
      delete (isAdmin ? socketsAdmin : socketsAgent)[clientId]
      adminBroadcast({ type: 'agent-off', id: clientId })
    }
    socket.onmessage = (e) => {
    }
    return response
  } else {
    return new Response(indexHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

const handleConn = async (conn) => {
  const httpConn = Deno.serveHttp(conn)
  for await (const evt of httpConn) {
    const req = evt.request
    try {
      evt.respondWith(await serveReq(req))
    } catch (e) {
      log(`Error: ${e}`)
      evt.respondWith(new Response('', { status: 500 }))
    }
  }
}
while (true) {
  const conn = await server.accept()
  handleConn(conn)
}
