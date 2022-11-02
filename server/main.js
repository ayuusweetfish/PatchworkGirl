const log = (msg) => console.log(`${(new Date()).toISOString()} ${msg}`)

const indexHtml = await Deno.readTextFile('index.html')

const port = +Deno.env.get('PORT') || 1026
const server = Deno.listen({ port })
log(`Running at http://localhost:${port}/`)

const password = Deno.env.get('PASS')
console.assert(password, 'Please specify a password through the PASS environment variable')

const socketsAdmin = {}
const socketsAgent = {}

const adminBroadcast = (obj) => {
  const str = JSON.stringify(obj)
  for (const socket of Object.values(socketsAdmin)) socket.send(str)
}

const tryParseObject = (s) => {
  try {
    const o = JSON.parse(s)
    if (typeof o !== 'object' || o === null) return {}
    return o
  } catch {
    return {}
  }
}

const serveReq = (req) => {
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req)
    let clientId = crypto.randomUUID()
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
      const o = tryParseObject(e.data)
      if (o.type === 'intro') {
        initialized = true
        if (o.auth === password) {
          log(`Agent ${clientId} authorized as administrator`)
          socketsAdmin[clientId] = socket
          send({ type: 'auth', success: true })
          for (const [agentClientId, { disp, elements }] of Object.entries(socketsAgent))
            send({ type: 'agent-on', id: agentClientId, disp, elements })
          socket.onclose = () => {
            delete socketsAdmin[clientId]
          }
          socket.onmessage = (e) => {
            const o = tryParseObject(e.data)
            if (socketsAgent[o.id] === undefined) { return }
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
          let replaced = false
          if (o.id !== undefined) {
            if (socketsAgent[o.id] !== undefined) {
              const previousSocket = socketsAgent[o.id].socket
              previousSocket.onclose = () => {}
              previousSocket.close()
              for (const el of elements) if (el.type === 'slider') {
                adminBroadcast({ type: 'agent-upd', id: o.id, ts: '', key: el.name, val: +el.val })
              }
              replaced = true
            }
            log(`Agent ${clientId} renamed to ${o.id}${replaced ? ', replacing original' : ''}`)
            clientId = o.id
          }
          if (!replaced) {
            adminBroadcast({ type: 'agent-on', id: clientId, disp, elements })
          }
          socketsAgent[clientId] = { socket, disp, elements }
          socket.onmessage = (e) => {
            const o = tryParseObject(e.data)
            if (o.type === 'done') {
              adminBroadcast({ type: 'agent-done', id: clientId, ts: o.ts, action: o.action })
            } else if (o.type === 'upd') {
              elements[elementsIdx[o.key]].val = +o.val
              adminBroadcast({ type: 'agent-upd', id: clientId, ts: o.ts, key: o.key, val: +o.val })
            }
          }
          socket.onclose = (e) => {
            log(`Agent ${clientId} disconnected: code = ${e.code}`)
            adminBroadcast({ type: 'agent-off', id: clientId })
            delete socketsAgent[clientId]
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
      await evt.respondWith(serveReq(req))
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
