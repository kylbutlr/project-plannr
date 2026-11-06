// swift-tools-version: 5.9

import PackageDescription

let package = Package(
  name: "AppStylr",
  platforms: [
    .macOS(.v10_15),
    .iOS(.v13),
    .tvOS(.v13),
    .watchOS(.v6)
  ],
  products: [
    .library(name: "AppStylr", targets: ["AppStylr"])
  ],
  targets: [
    .target(
      name: "AppStylr",
      path: "adapters/swift"
    )
  ]
)
