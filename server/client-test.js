let socket
const reconnect = () => {
  socket = new WebSocket('ws://localhost:1026/')
  socket.onopen = () => {}
  socket.onclose = () => setTimeout(() => reconnect(), 1000)
  const send = (o) => socket.send(JSON.stringify(o))
  socket.onmessage = (e) => {
    const o = JSON.parse(e.data)
    if (o.type === 'id') {
      console.log(`Connected! Client ID is ${o.id}`)
      send({ type: 'upd', ts: 0, key: 's1', val: 2 })
      send({ type: 'upd', ts: 0, key: 's2', val: 0.4 })
    } else if (o.type === 'act') {
      setTimeout(() => {
        send({ type: 'done', ts: o.ts, name: o.name })
        if (o.name === 'a1')
          send({ type: 'upd', ts: o.ts, key: 's2', val: Math.random() })
      }, 1000)
    } else if (o.type === 'set') {
      setTimeout(() => send({ type: 'upd', ts: o.ts, key: o.key, val: o.val }), 1000)
    }
  }
}
reconnect()
