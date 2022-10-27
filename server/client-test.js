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
      send({ type: 'intro', disp: 'Test Client', elements: [
        { name: 'a1', type: 'action', disp: 'Action One' },
        { name: 'a2', type: 'action', disp: 'Action Two' },
        { name: 's1', type: 'slider', disp: 'Slider One', min: -10, max: 10, val: 3, step: 1 },
        { name: 's2', type: 'slider', disp: 'Slider Two', min: 0, max: 1, val: 0.4, step: 0.01 },
        { name: 'a3', type: 'action', disp: '动作三' },
      ]})
    } else if (o.type === 'act') {
      setTimeout(() => {
        send({ type: 'done', ts: o.ts, action: o.action })
        if (o.action === 'a1')
          send({ type: 'upd', ts: o.ts, key: 's2', val: Math.floor(Math.random() * 100) / 100 })
      }, 1000)
    } else if (o.type === 'set') {
      const val = (o.key === 's1' ? Math.round(o.val / 3) * 3 : o.val)
      setTimeout(() => send({ type: 'upd', ts: o.ts, key: o.key, val }), 200)
    }
  }
}
reconnect()
