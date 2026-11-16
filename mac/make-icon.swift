// Renders the app icon (warm office tile + pixel mascot) into an .iconset directory.
import AppKit
let out = CommandLine.arguments[1]
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
let mascot = ["..#######..","..#.###.#..","###########","..#######..","..#.#.#.#..","..#.#.#.#.."]
func render(_ s: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: s, pixelsHigh: s, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let f = CGFloat(s)
    let tile = NSRect(x: f*0.06, y: f*0.06, width: f*0.88, height: f*0.88)
    let path = NSBezierPath(roundedRect: tile, xRadius: f*0.2, yRadius: f*0.2)
    NSGraphicsContext.current!.saveGraphicsState()
    let sh = NSShadow(); sh.shadowColor = NSColor(white: 0, alpha: 0.35); sh.shadowBlurRadius = f*0.03; sh.shadowOffset = NSSize(width: 0, height: -f*0.015); sh.set()
    NSColor(srgbRed: 1, green: 0.82, blue: 0.5, alpha: 1).setFill(); path.fill()
    NSGraphicsContext.current!.restoreGraphicsState()
    NSGradient(colors: [NSColor(srgbRed: 1, green: 0.84, blue: 0.55, alpha: 1), NSColor(srgbRed: 0.93, green: 0.6, blue: 0.3, alpha: 1)])!.draw(in: path, angle: -90)
    // floor planks
    NSColor(srgbRed: 0.5, green: 0.3, blue: 0.1, alpha: 0.18).setFill()
    for i in 0..<4 { NSRect(x: tile.minX, y: tile.minY + CGFloat(i) * f*0.075, width: tile.width, height: f*0.006).fill() }
    // desk
    NSColor(srgbRed: 0.72, green: 0.46, blue: 0.25, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: f*0.2, y: f*0.2, width: f*0.6, height: f*0.12), xRadius: f*0.03, yRadius: f*0.03).fill()
    // mascot
    let px = f * 0.062
    let x0 = (f - 11 * px) / 2, y0 = f * 0.34
    NSColor(srgbRed: 0xD9/255, green: 0x77/255, blue: 0x57/255, alpha: 1).setFill()
    for (r, line) in mascot.enumerated() { for (c, ch) in line.enumerated() where ch == "#" {
        NSRect(x: x0 + CGFloat(c)*px, y: y0 + CGFloat(mascot.count - 1 - r)*px, width: px, height: px).fill() } }
    NSColor(srgbRed: 0.2, green: 0.12, blue: 0.08, alpha: 1).setFill()
    for c in [3, 7] { NSRect(x: x0 + CGFloat(c)*px, y: y0 + 4*px, width: px, height: px).fill() }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}
for (n, s) in [("16",16),("16@2x",32),("32",32),("32@2x",64),("128",128),("128@2x",256),("256",256),("256@2x",512),("512",512),("512@2x",1024)] {
    let base = n.replacingOccurrences(of: "@2x", with: "")
    let suffix = n.hasSuffix("@2x") ? "@2x" : ""
    try! render(s).write(to: URL(fileURLWithPath: "\(out)/icon_\(base)x\(base)\(suffix).png"))
}
// Modern ICNS entries contain PNG payloads. Package them directly so builds also
// work where iconutil's image conversion service is unavailable.
if CommandLine.arguments.count > 2 {
    func lengthBytes(_ value: Int) -> Data {
        Data([UInt8((value >> 24) & 255), UInt8((value >> 16) & 255), UInt8((value >> 8) & 255), UInt8(value & 255)])
    }
    var entries = Data()
    for (type, filename) in [("ic07", "128x128"), ("ic08", "256x256"), ("ic09", "512x512"), ("ic10", "512x512@2x"), ("ic11", "16x16@2x"), ("ic12", "32x32@2x"), ("ic13", "128x128@2x"), ("ic14", "256x256@2x")] {
        let png = try Data(contentsOf: URL(fileURLWithPath: "\(out)/icon_\(filename).png"))
        entries.append(contentsOf: type.utf8)
        entries.append(lengthBytes(png.count + 8))
        entries.append(png)
    }
    var icon = Data("icns".utf8)
    icon.append(lengthBytes(entries.count + 8))
    icon.append(entries)
    try icon.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
}
