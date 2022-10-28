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

let setCommandCount = 0

const serveReq = async (req) => {
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req)
    const path = (new URL(req.url)).pathname
    const clientId = crypto.randomUUID()
    const send = (o) => socket.send(JSON.stringify(o))
    let initialized = false
    socket.onopen = () => {
      log(`Agent ${clientId} connected`)
      send({ type: 'id', id: clientId })
      setTimeout(() => {
        if (!initialized) {
          log(`Agent ${clientId} never introduced itself, disconnecting`)
          socket.close()
        }
      }, 5000)
    }
    socket.onmessage = (e) => {
      const o = JSON.parse(e.data)
      if (o.type === 'intro') {
        initialized = true
        if (o.auth === '111') {
          log(`Agent ${clientId} authorized as administrator`)
          socketsAdmin[clientId] = socket
          send({ type: 'auth', success: true })
          for (const [agentClientId, { disp, elements }] of Object.entries(socketsAgent))
            send({ type: 'agent-on', id: agentClientId, disp, elements })
          socket.onclose = () => {
            delete socketsAdmin[clientId]
          }
          socket.onmessage = (e) => {
            const o = JSON.parse(e.data)
            const { socket } = socketsAgent[o.id]
            if (o.type === 'act') {
              socket.send(JSON.stringify({ type: 'act', ts: o.ts, action: o.action }))
            } else if (o.type === 'set') {
              socket.send(JSON.stringify({ type: 'set', ts: o.ts, key: o.key, val: +o.val }))
            }
          }
        } else if (o.auth !== undefined) {
          log(`Agent ${clientId} fails to authorize`)
          send({ type: 'auth', success: false })
        } else {
          const elements = []
          const elementsIdx = {}
          const disp = o.disp
          for (const el of o.elements) {
            elementsIdx[el.name] = elements.length
            if (el.type === 'action') {
              elements.push({ type: 'action', name: el.name, disp: el.disp })
            } else if (el.type === 'slider') {
              elements.push({ type: 'slider', name: el.name, disp: el.disp,
                min: +el.min, max: +el.max, step: +el.step || 'any', val: +el.val })
            }
          }
          adminBroadcast({ type: 'agent-on', id: clientId, disp, elements })
          socketsAgent[clientId] = { socket, disp, elements }
          socket.onmessage = (e) => {
            const o = JSON.parse(e.data)
            if (o.type === 'done') {
              adminBroadcast({ type: 'agent-done', id: clientId, ts: o.ts, action: o.action })
            } else if (o.type === 'upd') {
              elements[elementsIdx[o.key]].val = +o.val
              adminBroadcast({ type: 'agent-upd', id: clientId, ts: o.ts, key: o.key, val: +o.val })
            }
          }
          socket.onclose = () => {
            adminBroadcast({ type: 'agent-off', id: clientId })
            delete socketsAgent[clientId]
          }
        }
      }
    }
    return response
  } else {
    const indexHtml = await Deno.readTextFile('index.html')
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
      await evt.respondWith(await serveReq(req))
    } catch (e) {
      log(`Error: ${e}`)
      try {
        await evt.respondWith(new Response('', { status: 500 }))
      } catch (e) {
        log(`Cannot return 500 response: ${e}`)
      }
    }
  }
}
while (true) {
  const conn = await server.accept()
  handleConn(conn)
}
