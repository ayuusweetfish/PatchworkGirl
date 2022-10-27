import Foundation
import Starscream

var request: URLRequest!
var socket: WebSocket!

let output = SoundOutputManager()

func reconnect() {
  request = URLRequest(url: URL(string: "http://localhost:1026")!)
  request.timeoutInterval = 5
  socket = WebSocket(request: request)
  socket.callbackQueue = DispatchQueue(label: "art.0-th.patchwork.remoteaudiocontrol")

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
    case .text(let string):
      struct MessageHeader: Codable {
        let type: String
      }
      let header = try! JSONDecoder().decode(MessageHeader.self, from: string.data(using: .utf8)!)
      switch header.type {
      case "id":
        let vol = try! output.readVolume()
        let bal = try! output.readBalance()
        send(string: #"""
        { "type": "intro", "disp": "macOS Audio", "elements": [
          { "name": "vol", "type": "slider", "disp": "Volume", "min": 0, "max": 1, "step": 0.01, "val": \#(vol) },
          { "name": "bal", "type": "slider", "disp": "Balance", "min": 0, "max": 1, "step": 0.01, "val": \#(bal) }
        ] }
        """#)
      case "set":
        struct SetMessage: Codable {
          let ts: String
          let key: String
          let val: Float
        }
        let msg = try! JSONDecoder().decode(SetMessage.self, from: string.data(using: .utf8)!)
        switch msg.key {
        case "vol":
          try! output.setVolume(msg.val)
          let newval = try! output.readVolume()
          send(string: #"{ "type": "upd", "ts": "\#(msg.ts)", "key": "\#(msg.key)", "val": \#(newval) }"#)
        case "bal":
          try! output.setBalance(msg.val)
          let newval = try! output.readBalance()
          send(string: #"{ "type": "upd", "ts": "\#(msg.ts)", "key": "\#(msg.key)", "val": \#(newval) }"#)
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

  socket.connect()
}

reconnect()

while true {
  Thread.sleep(forTimeInterval: 10)
}
