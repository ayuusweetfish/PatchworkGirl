const action1 = () => console.log('Action 1 triggered')
const action2 = () => console.log('Action 2 triggered')
let value1 = 0.3
let value2 = 0

let socket
const reconnect = () => {
  socket = new WebSocket('ws://localhost:1026/')
  socket.onopen = () => {}
  socket.onclose = () => {
    socket = undefined
    setTimeout(() => reconnect(), 1000)
  }
  socket.onmessage = (e) => {
    const o = JSON.parse(e.data)
    if (o.type === 'id') {
      console.log('Connected!')
      socket.send(JSON.stringify({
        type: 'intro',
        disp: 'Test Client',
        elements: [
          { name: 'a1', type: 'action', disp: 'An action' },
          { name: 'a2', type: 'action', disp: 'Another action' },
          { name: 's1', type: 'slider', disp: 'A slider',
            min: -1, max: 1, val: value1 },
          { name: 's2', type: 'slider', disp: 'Another slider',
            min: 0, max: 10, step: 1, val: value2 },
        ]
      }))
    } else if (o.type === 'act') {
      if (o.name === 'a1') action1()
      if (o.name === 'a2') action2()
      socket.send(JSON.stringify({ type: 'done', ts: o.ts }))
    } else if (o.type === 'set') {
      if (o.name === 's1') value1 = o.val
      if (o.name === 's2') value2 = o.val
      socket.send(JSON.stringify({ type: 'upd', ts: o.ts, val: o.val }))
    }
  }
}
reconnect()

// Also possible to actively change values
setInterval(() => {
  value2 = (value2 + 1) % 11
  if (socket !== undefined)
    socket.send(JSON.stringify({ type: 'upd', name: 's2', val: value2 }))
}, 5000)
