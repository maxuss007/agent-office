// ao-input: small helper that lets Agent Office agents see and use the Mac.
// It runs as a child of Agent Office.app, so macOS asks for (and remembers) the permissions in the app's name.
//
//   ao-input perms                      -> {"screen":true,"accessibility":false}
//   ao-input request screen|accessibility
//   ao-input screen                     -> {"width":1512,"height":982,"scale":2}
//   ao-input click X Y [left|right|double]
//   ao-input move X Y
//   ao-input drag X1 Y1 X2 Y2
//   ao-input scroll DY [DX]
//   ao-input type TEXT
//   ao-input key cmd+shift+a | return | escape | tab | left ...
import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

func out(_ s: String) { FileHandle.standardOutput.write((s + "\n").data(using: .utf8)!) }
func fail(_ s: String) -> Never { FileHandle.standardError.write((s + "\n").data(using: .utf8)!); exit(1) }

let a = CommandLine.arguments
guard a.count >= 2 else { fail("usage: ao-input perms|request|screen|click|move|drag|scroll|type|key") }
let src = CGEventSource(stateID: .hidSystemState)

func needAX() { if !AXIsProcessTrusted() { fail("accessibility-denied") } }
func num(_ i: Int) -> Double { guard a.count > i, let v = Double(a[i]) else { fail("missing number") }; return v }
func post(_ e: CGEvent?) { e?.post(tap: .cghidEventTap); usleep(12000) }

let keyCodes: [String: CGKeyCode] = [
  "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
  "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,
  "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "return": 36, "enter": 36, "l": 37, "j": 38, "'": 39, "k": 40, ";": 41,
  "\\": 42, ",": 43, "/": 44, "n": 45, "m": 46, ".": 47, "tab": 48, "space": 49, "`": 50, "delete": 51, "backspace": 51,
  "escape": 53, "esc": 53, "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "home": 115, "pageup": 116,
  "forwarddelete": 117, "end": 119, "pagedown": 121, "left": 123, "right": 124, "down": 125, "up": 126,
]

switch a[1] {
case "perms":
  // Automation: allowed when macOS already lets this app control Finder or System Events (checked without asking)
  let automation = ["com.apple.finder", "com.apple.systemevents"].contains { id in
    AEDeterminePermissionToAutomateTarget(NSAppleEventDescriptor(bundleIdentifier: id).aeDesc, typeWildCard, typeWildCard, false) == noErr }
  out("{\"screen\":\(CGPreflightScreenCaptureAccess()),\"accessibility\":\(AXIsProcessTrusted()),\"automation\":\(automation)}")
case "request":
  if a.count > 2 && a[2] == "screen" { out("{\"screen\":\(CGRequestScreenCaptureAccess())}") }
  else {
    let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    out("{\"accessibility\":\(AXIsProcessTrustedWithOptions(opts))}")
  }
case "screen":
  let b = CGDisplayBounds(CGMainDisplayID())
  let scale = NSScreen.main?.backingScaleFactor ?? 1
  out("{\"width\":\(Int(b.width)),\"height\":\(Int(b.height)),\"scale\":\(scale)}")
case "move":
  needAX(); post(CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: CGPoint(x: num(2), y: num(3)), mouseButton: .left))
case "click":
  needAX()
  let p = CGPoint(x: num(2), y: num(3)); let kind = a.count > 4 ? a[4] : "left"
  let right = kind == "right"
  let down: CGEventType = right ? .rightMouseDown : .leftMouseDown, up: CGEventType = right ? .rightMouseUp : .leftMouseUp
  let btn: CGMouseButton = right ? .right : .left
  post(CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: btn))
  for n in 1...(kind == "double" ? 2 : 1) {
    let d = CGEvent(mouseEventSource: src, mouseType: down, mouseCursorPosition: p, mouseButton: btn)
    let u = CGEvent(mouseEventSource: src, mouseType: up, mouseCursorPosition: p, mouseButton: btn)
    d?.setIntegerValueField(.mouseEventClickState, value: Int64(n)); u?.setIntegerValueField(.mouseEventClickState, value: Int64(n))
    post(d); post(u)
  }
case "drag":
  needAX()
  let p1 = CGPoint(x: num(2), y: num(3)), p2 = CGPoint(x: num(4), y: num(5))
  post(CGEvent(mouseEventSource: src, mouseType: .leftMouseDown, mouseCursorPosition: p1, mouseButton: .left))
  for i in 1...20 {
    let t = Double(i) / 20
    post(CGEvent(mouseEventSource: src, mouseType: .leftMouseDragged, mouseCursorPosition: CGPoint(x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t), mouseButton: .left))
  }
  post(CGEvent(mouseEventSource: src, mouseType: .leftMouseUp, mouseCursorPosition: p2, mouseButton: .left))
case "scroll":
  needAX()
  post(CGEvent(scrollWheelEvent2Source: src, units: .pixel, wheelCount: 2, wheel1: Int32(num(2)), wheel2: Int32(a.count > 3 ? num(3) : 0), wheel3: 0))
case "type":
  needAX()
  guard a.count > 2 else { fail("missing text") }
  for ch in a[2...].joined(separator: " ").utf16 {
    var c = ch
    let d = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true), u = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
    d?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c); u?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
    post(d); post(u)
  }
case "key":
  needAX()
  guard a.count > 2 else { fail("missing key") }
  var flags: CGEventFlags = []; var code: CGKeyCode?
  for part in a[2].lowercased().split(separator: "+").map(String.init) {
    switch part {
    case "cmd", "command": flags.insert(.maskCommand)
    case "shift": flags.insert(.maskShift)
    case "alt", "option", "opt": flags.insert(.maskAlternate)
    case "ctrl", "control": flags.insert(.maskControl)
    case "fn": flags.insert(.maskSecondaryFn)
    default: code = keyCodes[part]
    }
  }
  guard let k = code else { fail("unknown key") }
  let d = CGEvent(keyboardEventSource: src, virtualKey: k, keyDown: true), u = CGEvent(keyboardEventSource: src, virtualKey: k, keyDown: false)
  d?.flags = flags; u?.flags = flags; post(d); post(u)
case "apps":
  let front = NSWorkspace.shared.frontmostApplication?.localizedName ?? ""
  let names = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }.compactMap { $0.localizedName }
  let data = try! JSONSerialization.data(withJSONObject: ["frontmost": front, "running": names])
  out(String(data: data, encoding: .utf8)!)
case "windows":
  let list = (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]) ?? []
  var rows: [[String: Any]] = []
  for w in list where (w[kCGWindowLayer as String] as? Int) == 0 {
    let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
    rows.append(["app": w[kCGWindowOwnerName as String] ?? "", "title": w[kCGWindowName as String] ?? "", "x": b["X"] ?? 0, "y": b["Y"] ?? 0, "width": b["Width"] ?? 0, "height": b["Height"] ?? 0])
  }
  out(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)
default:
  fail("unknown command")
}
