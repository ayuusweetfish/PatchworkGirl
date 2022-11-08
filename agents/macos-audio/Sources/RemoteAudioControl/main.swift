import Foundation
import Starscream

var request: URLRequest!
var socket: WebSocket!
var lastPong = 0.0
var lastClientId = ""

let output = SoundOutputManager()

func reconnect() {
  socket?.disconnect()

  request = URLRequest(url: URL(string: "http://localhost:1026")!)
  request.timeoutInterval = 5
  socket = WebSocket(request: request)
  socket.callbackQueue = DispatchQueue(label: "art.0-th.patchwork.remoteaudiocontrol")
  lastPong = Date().timeIntervalSince1970

  func send<T: Encodable>(o: T) {
    let s = String(data: try! JSONEncoder().encode(o), encoding: .utf8)!
    socket.write(string: s)
  }
  func send(string: String) {
    socket.write(string: string)
  }
  socket.onEvent = { event in
    switch event {
    case .connected(_):
      print("Connected!")
    case .disconnected(let reason, let code):
      print("Disconnected: reason \(reason); code: \(code)")
      reconnect()
    case .error(let err):
      print("Error: \(String(describing: err))")
      reconnect()
    case .pong(_):
      lastPong = Date().timeIntervalSince1970
    case .text(let string):
      struct MessageHeader: Codable {
        let type: String
      }
      let header = try! JSONDecoder().decode(MessageHeader.self, from: string.data(using: .utf8)!)
      switch header.type {
      case "id":
        struct IdMessage: Codable {
          let id: String
        }
        let msg = try! JSONDecoder().decode(IdMessage.self, from: string.data(using: .utf8)!)
        let vol = try! output.readVolume()
        let bal = try! output.readBalance()
        send(string: #"""
        { "type": "intro", "disp": "macOS Audio",
          \#(lastClientId == "" ? "" : ##""id": "\##(lastClientId)","##)
        "elements": [
          { "name": "vol", "type": "slider", "disp": "Volume", "min": 0, "max": 1, "step": 0.01, "val": \#(vol) },
          { "name": "bal", "type": "slider", "disp": "Balance", "min": 0, "max": 1, "step": 0.01, "val": \#(bal) }
        ] }
        """#)
        if lastClientId == "" {
          lastClientId = msg.id
        }
      case "set":
        struct SetMessage: Codable {
          let ts: String
          let name: String
          let val: Float
        }
        let msg = try! JSONDecoder().decode(SetMessage.self, from: string.data(using: .utf8)!)
        switch msg.key {
        case "vol":
          try! output.setVolume(msg.val)
          let newval = try! output.readVolume()
          send(string: #"{ "type": "upd", "ts": "\#(msg.ts)", "val": \#(newval) }"#)
        case "bal":
          try! output.setBalance(msg.val)
          let newval = try! output.readBalance()
          send(string: #"{ "type": "upd", "ts": "\#(msg.ts)", "val": \#(newval) }"#)
        default:
          break
        }
      default:
        print("Unknown message type \(header.type)")
      }
    default:
      print("Unhandled event \(event)")
      break
    }
  }

  print("Connecting!")
  socket.connect()
}

reconnect()

DispatchQueue(label: "pingpong", qos: .userInitiated).async {
  while true {
    if Date().timeIntervalSince1970 - lastPong >= 5 {
      reconnect()
    }
    socket.write(ping: Data())
    Thread.sleep(forTimeInterval: 1)
  }
}

while true {
  Thread.sleep(forTimeInterval: 10)
  print("Interrupting to test reconnection!")
  socket.disconnect()
}
