// Renders the installer artwork.
//   make-dmg-background <out.png>   window background (1320x1160 = @2x of the 660x580 window)
import AppKit
let args = CommandLine.arguments
func save(_ rep: NSBitmapImageRep, _ path: String) { try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path)) }
func canvas(_ w: Int, _ h: Int) -> NSBitmapImageRep { NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)! }
let W = 1320, H = 1160
let rep = canvas(W, H)
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGradient(colors: [NSColor(srgbRed: 0.97, green: 0.97, blue: 0.98, alpha: 1), NSColor(srgbRed: 0.92, green: 0.93, blue: 0.95, alpha: 1)])!.draw(in: NSRect(x: 0, y: 0, width: W, height: H), angle: -90)
// layout in window points (top-left origin; about 548 pt are visible under the title bar):
// one drop panel holding both icons (centres y=110, x 170 and 490), the arrow, three numbered steps,
// the Terminal command and, at the bottom, the "Terminal command.txt" file (centre x 330, y 446) to copy it from
let pt = { (y: CGFloat) in CGFloat(H) - y * 2 }
let orange = NSColor(srgbRed: 0.85, green: 0.47, blue: 0.34, alpha: 1)
let panel = NSBezierPath(roundedRect: NSRect(x: 40, y: pt(536), width: CGFloat(W) - 80, height: (536 - 16) * 2), xRadius: 36, yRadius: 36)
NSColor(white: 1, alpha: 0.85).setFill(); panel.fill()
panel.lineWidth = 3; panel.setLineDash([16, 10], count: 2, phase: 0); orange.withAlphaComponent(0.55).setStroke(); panel.stroke()
let y = pt(110), x0: CGFloat = 170 * 2 + 124, x1: CGFloat = 490 * 2 - 124
let shaft = NSBezierPath(); shaft.lineWidth = 10; shaft.lineCapStyle = .round
shaft.move(to: NSPoint(x: x0, y: y)); shaft.line(to: NSPoint(x: x1 - 24, y: y))
orange.setStroke(); shaft.stroke()
let head = NSBezierPath(); head.move(to: NSPoint(x: x1, y: y)); head.line(to: NSPoint(x: x1 - 44, y: y + 30)); head.line(to: NSPoint(x: x1 - 44, y: y - 30)); head.close()
orange.setFill(); head.fill()
let dark = NSColor(white: 0.13, alpha: 1), grey = NSColor(white: 0.4, alpha: 1)
func line(_ s: String, _ size: CGFloat, _ weight: NSFont.Weight, _ color: NSColor, _ top: CGFloat, x: CGFloat = 96, font: NSFont? = nil) {
  let a: [NSAttributedString.Key: Any] = [.font: font ?? NSFont.systemFont(ofSize: size * 2, weight: weight), .foregroundColor: color]
  (s as NSString).draw(at: NSPoint(x: x * 2, y: pt(top) - size * 2.4), withAttributes: a)
}
func step(_ n: Int, _ top: CGFloat) {
  let r = NSRect(x: 64 * 2, y: pt(top) - 21 * 2 + 4, width: 40, height: 40)
  orange.setFill(); NSBezierPath(ovalIn: r).fill()
  let p = NSMutableParagraphStyle(); p.alignment = .center
  ("\(n)" as NSString).draw(in: r.offsetBy(dx: 0, dy: -5), withAttributes: [.font: NSFont.systemFont(ofSize: 25, weight: .bold), .foregroundColor: NSColor.white, .paragraphStyle: p])
}
// a thin divider between the icons and the steps
NSColor(white: 0, alpha: 0.07).setFill(); NSRect(x: 96, y: pt(196), width: CGFloat(W) - 192, height: 2).fill()
step(1, 212); line("Drag Agent Office onto the Applications folder.", 14, .semibold, dark, 212)
step(2, 244); line("Open it. If macOS says it cannot verify the app:", 14, .semibold, dark, 244)
line("System Settings → Privacy & Security → scroll down and click Open Anyway.", 12.5, .regular, grey, 267)
line("Or open Terminal and paste this command (copy it from the file below):", 12.5, .regular, grey, 287)
// the command in a code box
let box = NSBezierPath(roundedRect: NSRect(x: 96 * 2, y: pt(338), width: (612 - 96) * 2, height: 30 * 2), xRadius: 14, yRadius: 14)
NSColor(srgbRed: 0.12, green: 0.13, blue: 0.16, alpha: 1).setFill(); box.fill()
line("xattr -dr com.apple.quarantine \"/Applications/Agent Office.app\"", 12, .regular, NSColor(srgbRed: 0.98, green: 0.84, blue: 0.75, alpha: 1), 316, x: 108,
     font: NSFont.monospacedSystemFont(ofSize: 24, weight: .medium))
step(3, 362); line("Done. On first launch it checks your tools and installs the plugins it needs.", 14, .semibold, dark, 362)
NSColor(white: 0, alpha: 0.07).setFill(); NSRect(x: 96, y: pt(388), width: CGFloat(W) - 192, height: 2).fill()
NSGraphicsContext.restoreGraphicsState()
save(rep, args[1])
