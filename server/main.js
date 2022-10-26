import { parse as parseYaml } from 'https://deno.land/std@0.160.0/encoding/yaml.ts'

const log = (msg) => console.log(`${(new Date()).toISOString()} ${msg}`)

const cfg = parseYaml(await Deno.readTextFile('config.yml'))

const indexHtml = await Deno.readTextFile('index.html')

const port = cfg.port || 1026
const server = Deno.listen({ port })
log(`Running at http://localhost:${port}/`)

const valueKeys = ['s1', 's2']

const socketsAdmin = {}
const socketsAgent = {}

const adminBroadcast = (obj) => {
  const str = JSON.stringify(obj)
  for (const socket of Object.values(socketsAdmin)) socket.send(str)
}

let setCommandCount = 0

const serveReq = async (req) => {
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req)
    const path = (new URL(req.url)).pathname
    const isAdmin = (path === '/admin')
    const clientId = `A-${crypto.randomUUID()}`
    const send = (o) => socket.send(JSON.stringify(o))
    if (isAdmin) {
      socket.onopen = () => {
        log('Admin connected')
        send({ type: 'id', id: clientId })
        socketsAdmin[clientId] = socket
        for (const [agentClientId, { values }] of Object.entries(socketsAgent))
          send({ type: 'agent-on', id: agentClientId, values })
      }
      socket.onclose = () => {
        delete socketsAdmin[clientId]
      }
      socket.onmessage = (e) => {
        const o = JSON.parse(e.data)
        const { socket } = socketsAgent[o.id]
        if (o.type === 'act') {
          socket.send(JSON.stringify({ type: 'act', ts: o.ts, name: o.name }))
        } else if (o.type === 'set') {
          socket.send(JSON.stringify({ type: 'set', ts: o.ts, key: o.key, val: o. val }))
        }
      }
    } else {
      const values = {}
      let initialized = false
      socket.onopen = () => {
        log(`Agent ${clientId} connected`)
        send({ type: 'id', id: clientId })
        setTimeout(() => {
          if (!initialized) {
            log(`Agent ${clientId} missing keys: ${(valueKeys.filter((k) => values[k] === undefined)).join(', ')}, disconnecting`)
            socket.close()
          }
        }, 5000)
      }
      socket.onclose = () => {
        if (initialized) {
          adminBroadcast({ type: 'agent-off', id: clientId })
          delete socketsAgent[clientId]
        }
      }
      socket.onmessage = (e) => {
        const o = JSON.parse(e.data)
        if (o.type === 'done') {
          adminBroadcast({ type: 'done', id: clientId, ts: o.ts, name: o.name })
        } else if (o.type === 'upd') {
          values[o.key] = o.val
          if (initialized) {
            adminBroadcast({ type: 'agent-upd', id: clientId, ts: o.ts, key: o.key, val: o.val })
          } else {
            if (valueKeys.every((k) => values[k] !== undefined)) {
              initialized = true;
              adminBroadcast({ type: 'agent-on', id: clientId, values })
              socketsAgent[clientId] = { socket, values }
            }
          }
        }
      }
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
