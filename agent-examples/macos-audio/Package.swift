// swift-tools-version:4.0
import PackageDescription

let package = Package(
  name: "RemoteAudioControl",
  products: [
    .executable(name: "RemoteAudioControl", targets: ["RemoteAudioControl"]),
  ],
  dependencies: [
    .package(url: "https://github.com/daltoniam/Starscream.git", .upToNextMajor(from: "4.0.0")),
  ],
  targets: [
    .target(name: "RemoteAudioControl", dependencies: ["Starscream"]),
  ]
)

