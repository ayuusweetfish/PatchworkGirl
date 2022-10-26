let socket
const reconnect = () => {
  socket = new WebSocket('ws://localhost:1026/')
  socket.onopen = () => console.log('Connected!')
  socket.onclose = () => setTimeout(() => reconnect(), 1000)
  socket.onmessage = (e) => {
    console.log(e.data)
  }
}
reconnect()
