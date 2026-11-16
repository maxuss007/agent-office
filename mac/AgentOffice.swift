// Agent Office – thin native shell: WKWebView + bundled node server, native notifications, menu bar status.
import AppKit
import WebKit
import UserNotifications

// MARK: - Mascot (same pixel-art Claude Code mascot as LidAwake)

let claudeOrange = NSColor(srgbRed: 0xD9 / 255, green: 0x77 / 255, blue: 0x57 / 255, alpha: 1)
let mascot = [
    "..#######..",
    "..#.###.#..",
    "###########",
    "..#######..",
    "..#.#.#.#..",
    "..#.#.#.#..",
]
let mascotStep = [
    ".#.#...#.#.",
    "#...#.#...#",
]

enum Status { case idle, working, waiting, done }

func menuBarIcon(_ status: Status, step: Bool = false) -> NSImage {
    let px: CGFloat = 1.6
    let size = NSSize(width: 20, height: 18)
    let rows = step ? Array(mascot.prefix(4)) + mascotStep : mascot
    let image = NSImage(size: size, flipped: true) { _ in
        (status == .idle ? NSColor.black : claudeOrange).set()
        let x0 = (size.width - CGFloat(mascot[0].count) * px) / 2 - 1
        let y0 = (size.height - CGFloat(mascot.count) * px) / 2
        for (row, line) in rows.enumerated() {
            for (col, c) in line.enumerated() where c == "#" {
                NSRect(x: x0 + CGFloat(col) * px, y: y0 + CGFloat(row) * px, width: px, height: px).fill()
            }
        }
        if status == .waiting || status == .done {
            (status == .waiting ? NSColor.systemRed : NSColor.systemGreen).set()
            NSBezierPath(ovalIn: NSRect(x: size.width - 7, y: 0, width: 7, height: 7)).fill()
        }
        return true
    }
    image.isTemplate = status == .idle
    return image
}

// MARK: - Node server

final class ServerManager {
    let token: String
    var port = 4747
    private var process: Process?
    let support: URL = {
        let u = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Agent Office")
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }()

    init() {
        let d = UserDefaults.standard
        if let t = d.string(forKey: "token") { token = t } else {
            token = (0..<12).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
            d.set(token, forKey: "token")
        }
    }

    var url: URL { URL(string: "http://127.0.0.1:\(port)/?t=\(token)")! }

    static func findNode() -> String? {
        let fm = FileManager.default
        let home = NSHomeDirectory()
        let own = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Agent Office/runtime/node/bin/node").path
        var c = [own, "/opt/homebrew/bin/node", "/usr/local/bin/node", "\(home)/.local/bin/node", "\(home)/.volta/bin/node", "\(home)/.bun/bin/node", "/usr/bin/node"]
        let nvm = "\(home)/.nvm/versions/node"
        if let vs = try? fm.contentsOfDirectory(atPath: nvm) { c += vs.sorted().reversed().map { "\(nvm)/\($0)/bin/node" } }
        if let hit = c.first(where: { fm.isExecutableFile(atPath: $0) }) { return hit }
        // last resort: ask the login shell
        let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/zsh"); p.arguments = ["-lc", "command -v node"]
        let pipe = Pipe(); p.standardOutput = pipe; p.standardError = FileHandle.nullDevice
        try? p.run(); p.waitUntilExit()
        let out = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return fm.isExecutableFile(atPath: out) ? out : nil
    }

    // Version of this Mac shell. Bump it (and "shell" in version.json) only when this file changes in a way the server relies on.
    static let shellVersion = 3
    var runningUpdate = false
    var onCrash: (() -> Void)?   // the server exited without being asked to
    var bundledDir: URL? { Bundle.main.resourceURL?.appendingPathComponent("server") }
    // An update downloaded from GitHub (see updater.mjs) lives in Application Support/Agent Office/app/<version>/.
    // Use it when it is newer than the copy inside the app; a newer DMG install wins over an older download.
    func serverDir() -> URL? {
        guard let bundled = bundledDir else { return nil }
        let cur = support.appendingPathComponent("app/current.json")
        guard let d = try? Data(contentsOf: cur), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let dir = j["dir"] as? String, FileManager.default.fileExists(atPath: dir + "/server.mjs") else { return bundled }
        return ServerManager.newer(ServerManager.version(URL(fileURLWithPath: dir)), than: ServerManager.version(bundled)) ? URL(fileURLWithPath: dir) : bundled
    }
    // a downloaded update that does not start is set aside, so the next start uses the app's own copy
    func dropUpdate() {
        let cur = support.appendingPathComponent("app/current.json")
        try? FileManager.default.removeItem(at: support.appendingPathComponent("app/current.bad.json"))
        try? FileManager.default.moveItem(at: cur, to: support.appendingPathComponent("app/current.bad.json"))
    }
    static func version(_ dir: URL) -> String {
        guard let d = try? Data(contentsOf: dir.appendingPathComponent("version.json")), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return "0" }
        return j["version"] as? String ?? "0"
    }
    static func newer(_ a: String, than b: String) -> Bool {
        let pa = a.split(separator: ".").map { Int($0) ?? 0 }, pb = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(pa.count, pb.count) { let x = i < pa.count ? pa[i] : 0, y = i < pb.count ? pb[i] : 0; if x != y { return x > y } }
        return false
    }

    static func portFree(_ port: Int) -> Bool {
        let s = socket(AF_INET, SOCK_STREAM, 0); if s < 0 { return false }
        defer { close(s) }
        var one: Int32 = 1; setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, socklen_t(MemoryLayout<Int32>.size))
        var a = sockaddr_in(); a.sin_family = sa_family_t(AF_INET); a.sin_port = in_port_t(port).bigEndian; a.sin_addr.s_addr = inet_addr("127.0.0.1")
        return withUnsafePointer(to: &a) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(s, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } } == 0
    }

    func start() -> String? { // returns an error message, or nil
        guard let node = ServerManager.findNode() else { return L("Node.js was not found. Install it from View → Set Up Tools… and open the app again.", "Nenašel jsem Node.js. Nainstaluj ho přes Zobrazení → Instalace nástrojů… a spusť aplikaci znovu.") }
        guard let res = serverDir(), FileManager.default.fileExists(atPath: res.appendingPathComponent("server.mjs").path) else { return L("The app is missing its server/ folder.", "V aplikaci chybí složka server/.") }
        runningUpdate = res != bundledDir
        guard let free = (4747...4770).first(where: ServerManager.portFree) else { return L("No free port between 4747 and 4770.", "Žádný volný port 4747–4770.") }
        port = free
        let p = Process()
        p.executableURL = URL(fileURLWithPath: node)
        p.arguments = ["server.mjs"]
        p.currentDirectoryURL = res
        var env = ProcessInfo.processInfo.environment
        env["PORT"] = String(port); env["HOST"] = "127.0.0.1"
        env["AGENT_OFFICE_HOME"] = support.path; env["AGENT_OFFICE_TOKEN"] = token
        env["AGENT_OFFICE_SHELL"] = String(ServerManager.shellVersion)
        env["AGENT_OFFICE_APP"] = "1"; env["AGENT_OFFICE_PROJECTS"] = NSHomeDirectory() + "/Agent Office"; env["AGENT_OFFICE_CWD"] = NSHomeDirectory()
        env["PATH"] = ["\(support.path)/runtime/node/bin", "\(NSHomeDirectory())/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", env["PATH"] ?? "/usr/bin:/bin"].joined(separator: ":")   // npm tools (codex, gemini) need node on PATH
        p.environment = env
        let log = support.appendingPathComponent("server.log")
        if !FileManager.default.fileExists(atPath: log.path) { FileManager.default.createFile(atPath: log.path, contents: nil) }
        if let h = try? FileHandle(forWritingTo: log) {   // append, so a crash stays in the log after the restart
            if (try? FileManager.default.attributesOfItem(atPath: log.path)[.size] as? Int ?? 0) ?? 0 > 2_000_000 { h.truncateFile(atOffset: 0) }
            h.seekToEndOfFile(); p.standardOutput = h; p.standardError = h
        }
        do { try p.run() } catch { return "Server se nespustil: \(error.localizedDescription)" }
        p.terminationHandler = { [weak self] proc in DispatchQueue.main.async { if self?.process === proc { self?.process = nil; self?.onCrash?() } } }
        process = p
        return nil
    }

    func waitReady(_ done: @escaping (Bool) -> Void) {
        var tries = 0
        func tick() {
            tries += 1
            var r = URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!); r.timeoutInterval = 1
            URLSession.shared.dataTask(with: r) { _, resp, _ in
                DispatchQueue.main.async {
                    if (resp as? HTTPURLResponse)?.statusCode == 200 { done(true) }
                    else if tries > 40 || self.process?.isRunning == false { done(false) }
                    else { DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: tick) }
                }
            }.resume()
        }
        tick()
    }

    func stop() { let p = process; process = nil; if let p = p, p.isRunning { p.terminate() } }
}

// MARK: - Language

// The UI language chosen in the app header (EN | CS); the server keeps it in config.json. English by default.
func L(_ en: String, _ cs: String) -> String {
    let cfg = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Agent Office/config.json")
    guard let d = try? Data(contentsOf: cfg), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any], j["lang"] as? String == "cs" else { return en }
    return cs
}

// MARK: - App

struct Question { let projectId: String; let repo: String; let id: String; let text: String; let options: [String] }

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    let server = ServerManager()
    var window: NSWindow!
    var web: WKWebView!
    let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let statusLine = NSMenuItem(title: L("Starting…", "Spouštím…"), action: nil, keyEquivalent: "")
    var timer: Timer?
    var notified = Set<String>()
    var finishedNotified = Set<String>()
    var runningCount = 0
    var serverUp = false
    var signalSources: [DispatchSourceSignal] = []

    func applicationDidFinishLaunching(_ n: Notification) {
        NSApp.setActivationPolicy(.regular)
        if let a = UserDefaults.standard.string(forKey: "appearance") { NSApp.appearance = NSAppearance(named: a == "dark" ? .darkAqua : .aqua) } // testing hook; normally follows the system
        // make sure the node child never outlives the app, even on SIGTERM/SIGINT
        for sig in [SIGTERM, SIGINT, SIGHUP] {
            signal(sig, SIG_IGN)
            let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
            src.setEventHandler { [weak self] in self?.server.stop(); exit(0) }
            src.resume(); signalSources.append(src)
        }
        buildMenus()
        buildWindow()
        buildStatusItem()
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }

        server.onCrash = { [weak self] in self?.serverCrashed() }
        firstRunSetup { self.startServer() }
    }

    // First launch (and whenever Node.js or both Claude and Codex are missing): a setup screen that shows what is
    // installed and installs the rest on a click, via the bundled scripts/install.sh. No Homebrew, no admin password.
    var setupNext: (() -> Void)?
    var installScript: URL? { Bundle.main.resourceURL?.appendingPathComponent("server/scripts/install.sh") }
    func firstRunSetup(_ next: @escaping () -> Void) {
        let mark = server.support.appendingPathComponent(".setup-done")
        guard installScript.map({ FileManager.default.fileExists(atPath: $0.path) }) == true else { next(); return }
        toolStatus { json in
            let st = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: [String: Any]] ?? [:]
            let has = { (k: String) in st[k]?["ok"] as? Bool == true }
            let ready = has("node") && (has("claude") || has("codex"))
            if ready && FileManager.default.fileExists(atPath: mark.path) { next(); return }
            self.setupNext = { try? Data().write(to: mark); next() }
            self.showSetup(json)
        }
    }
    @objc func openSetup() { // menu: Set Up Tools…
        showWindow()
        setupNext = { [weak self] in self?.reloadPage() }
        toolStatus { self.showSetup($0) }
    }
    func toolEnv() -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = ["\(server.support.path)/runtime/node/bin", "\(NSHomeDirectory())/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", env["PATH"] ?? "/usr/bin:/bin"].joined(separator: ":")
        env["AGENT_OFFICE_HOME"] = server.support.path
        return env
    }
    func toolStatus(_ done: @escaping (String) -> Void) {
        guard let script = installScript else { done("{}"); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/bash"); p.arguments = [script.path, "--status"]; p.environment = self.toolEnv()
            let pipe = Pipe(); p.standardOutput = pipe; p.standardError = FileHandle.nullDevice
            var out = "{}"
            if (try? p.run()) != nil { out = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "{}"; p.waitUntilExit() }
            if (try? JSONSerialization.jsonObject(with: Data(out.utf8))) == nil { out = "{}" }
            DispatchQueue.main.async { done(out) }
        }
    }
    func showSetup(_ status: String) {
        guard let f = Bundle.main.url(forResource: "setup", withExtension: "html"), let html = try? String(contentsOf: f, encoding: .utf8) else { setupNext?(); return }
        web.loadHTMLString(html.replacingOccurrences(of: "{{LANG}}", with: L("en", "cs")).replacingOccurrences(of: "{{STATUS}}", with: status), baseURL: nil)
    }
    func js(_ code: String) { web.evaluateJavaScript(code, completionHandler: nil) }
    func jsString(_ s: String) -> String { (try? String(data: JSONSerialization.data(withJSONObject: [s]), encoding: .utf8)).flatMap { $0.map { String($0.dropFirst().dropLast()) } } ?? "\"\"" }
    /** Installs the items one after another, streaming the installer's output to the setup screen. */
    func install(_ items: [String]) {
        guard let script = installScript, let item = items.first else { toolStatus { self.js("ao.render(\($0));ao.done()") }; return }
        js("ao.busy(\(jsString(item)))")
        let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/bash"); p.arguments = [script.path, item]; p.environment = toolEnv()
        let pipe = Pipe(); p.standardOutput = pipe; p.standardError = pipe
        var buffer = ""
        pipe.fileHandleForReading.readabilityHandler = { h in
            let chunk = String(data: h.availableData, encoding: .utf8) ?? ""; if chunk.isEmpty { return }
            DispatchQueue.main.async {
                buffer += chunk.replacingOccurrences(of: "\r", with: "\n")
                while let r = buffer.range(of: "\n") { let line = String(buffer[..<r.lowerBound]); buffer.removeSubrange(..<r.upperBound); if !line.isEmpty { self.js("ao.log(\(self.jsString(line)))") } }
            }
        }
        p.terminationHandler = { proc in
            pipe.fileHandleForReading.readabilityHandler = nil
            DispatchQueue.main.async {
                let ok = proc.terminationStatus == 0
                self.js("ao.log(\(self.jsString((ok ? "✓ " : "✗ ") + item)))")
                self.toolStatus { st in self.js("ao.render(\(st))"); self.install(Array(items.dropFirst())) }
            }
        }
        do { try p.run() } catch { js("ao.log(\(jsString(error.localizedDescription)));ao.done()") }
    }

    func startServer() {
        if let err = server.start() { showError(err); return }
        showHTML(L("<h2>Starting the office…</h2>", "<h2>Spouštím kancelář…</h2>"))
        server.waitReady { ok in
            if ok { self.serverUp = true; self.web.load(URLRequest(url: self.pageURL())); if self.timer == nil { self.startPolling() } }
            else if self.server.runningUpdate { self.server.stop(); self.server.dropUpdate(); self.startServer() }   // broken update: fall back to the app's own copy
            else { self.showError(L("The server did not start. See ~/Library/Application Support/Agent Office/server.log", "Server nenaběhl. Podívej se do ~/Library/Application Support/Agent Office/server.log")) }
        }
    }

    // the server died (a bug, a bad update): start it again and reload, but give up after repeated crashes
    var crashes: [Date] = []
    func serverCrashed() {
        serverUp = false
        crashes = crashes.filter { $0.timeIntervalSinceNow > -120 } + [Date()]
        if crashes.count > 5 { showError(L("The server keeps crashing. See ~/Library/Application Support/Agent Office/server.log", "Server opakovaně padá. Podívej se do ~/Library/Application Support/Agent Office/server.log")); return }
        if server.runningUpdate && crashes.count >= 2 { server.dropUpdate() }
        showHTML(L("<h2>Restarting the office…</h2>", "<h2>Restartuji kancelář…</h2>"))
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.startServer() }
    }

    // after an update was downloaded: start the server again from the new files and reload the page
    func restartServer() {
        serverUp = false; server.stop()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.startServer() }
    }

    // window
    func buildWindow() {
        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(self, name: "pickFolder")
        cfg.userContentController.add(self, name: "restartServer")
        cfg.userContentController.add(self, name: "setup")
        web = WKWebView(frame: .zero, configuration: cfg)
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Agent Office"
        window.contentView = web
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("AgentOfficeWindow")
        window.minSize = NSSize(width: 760, height: 560)   // a saved frame can be tiny (display changes); never restore an unusable window
        if window.frame.width < 760 || window.frame.height < 560 { window.setContentSize(NSSize(width: max(window.frame.width, 1180), height: 860)); window.center() }
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    func showHTML(_ body: String) {
        let css = "body{font:16px -apple-system;background:#f6ead2;color:#3a2a1a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}@media(prefers-color-scheme:dark){body{background:#241a12;color:#f6e8cf}}div{max-width:460px;padding:24px}"
        web.loadHTMLString("<meta charset=utf-8><style>\(css)</style><div>\(body)</div>", baseURL: nil)
    }
    func showError(_ msg: String) { showHTML(L("<h2>Agent Office cannot start</h2>", "<h2>Agent Office nejde spustit</h2>") + "<p>\(msg)</p>") }
    func showWindow() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }

    func windowShouldClose(_ sender: NSWindow) -> Bool { sender.orderOut(nil); return false } // projects keep running
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { showWindow(); return true }
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { false }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if runningCount > 0 {
            showWindow()
            let a = NSAlert()
            a.messageText = runningCount == 1 ? L("1 project is running", "Běží 1 projekt") : L("\(runningCount) projects are running", "Běží \(runningCount) projektů")
            a.informativeText = L("Quitting the app stops the projects (work in progress stays on the office/… branch). Quit anyway?", "Když aplikaci ukončíš, projekty se zastaví (rozdělaná práce zůstane ve větvi office/…). Chceš ji ukončit?")
            a.addButton(withTitle: L("Keep running in the background", "Nechat běžet na pozadí"))
            a.addButton(withTitle: L("Quit and stop", "Ukončit a zastavit"))
            if a.runModal() == .alertFirstButtonReturn { window.orderOut(nil); return .terminateCancel }
        }
        return .terminateNow
    }
    func applicationWillTerminate(_ n: Notification) { server.stop() }

    // native folder picker for "add repo"
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        if m.name == "restartServer" { restartServer(); return }
        if m.name == "setup", let b = m.body as? [String: Any], let action = b["action"] as? String {
            switch action {
            case "install": install((b["items"] as? [String] ?? []).filter { ["node", "claude", "codex", "gemini", "antigravity", "plugins", "skills"].contains($0) })
            case "continue": let n = setupNext; setupNext = nil; n?()
            case "copy": NSPasteboard.general.clearContents(); NSPasteboard.general.setString(b["text"] as? String ?? "", forType: .string)
            case "open": if let s = b["url"] as? String, let u = URL(string: s), u.scheme == "https" { NSWorkspace.shared.open(u) }
            default: break
            }
            return
        }
        guard m.name == "pickFolder" else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
        panel.prompt = L("Add", "Přidat"); panel.message = L("Choose the folder (repository) for the new office", "Vyber složku (repozitář), pro který vznikne nová kancelář")
        panel.directoryURL = URL(fileURLWithPath: NSHomeDirectory())
        panel.beginSheetModal(for: window) { r in
            guard r == .OK, let u = panel.url else { return }
            let js = "window.onFolderPicked(\(String(data: (try? JSONSerialization.data(withJSONObject: [u.path])) ?? Data(), encoding: .utf8) ?? "[]")[0])"
            self.web.evaluateJavaScript(js)
        }
    }

    // WKUIDelegate: JS alert / confirm
    // window.open(...) from the page (e.g. the download link for a new app version) opens in the default browser
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url, u.scheme == "https" { NSWorkspace.shared.open(u) }
        return nil
    }
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler c: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = m; a.runModal(); c()
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler c: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "OK"); a.addButton(withTitle: L("Cancel", "Zrušit")); c(a.runModal() == .alertFirstButtonReturn)
    }

    // menus
    func buildMenus() {
        let main = NSMenu()
        func sub(_ title: String, _ items: [NSMenuItem]) { let i = NSMenuItem(); main.addItem(i); let m = NSMenu(title: title); items.forEach(m.addItem); i.submenu = m }
        sub("Agent Office", [
            NSMenuItem(title: L("Hide Agent Office", "Skrýt Agent Office"), action: #selector(NSApplication.hide(_:)), keyEquivalent: "h"),
            .separator(),
            NSMenuItem(title: L("Quit Agent Office", "Ukončit Agent Office"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")])
        sub(L("Edit", "Úpravy"), [
            NSMenuItem(title: L("Undo", "Zpět"), action: Selector(("undo:")), keyEquivalent: "z"),
            .separator(),
            NSMenuItem(title: L("Cut", "Vyjmout"), action: #selector(NSText.cut(_:)), keyEquivalent: "x"),
            NSMenuItem(title: L("Copy", "Kopírovat"), action: #selector(NSText.copy(_:)), keyEquivalent: "c"),
            NSMenuItem(title: L("Paste", "Vložit"), action: #selector(NSText.paste(_:)), keyEquivalent: "v"),
            NSMenuItem(title: L("Select All", "Vybrat vše"), action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")])
        let reload = NSMenuItem(title: L("Reload", "Načíst znovu"), action: #selector(reloadPage), keyEquivalent: "r"); reload.target = self
        let tools = NSMenuItem(title: L("Set Up Tools…", "Instalace nástrojů…"), action: #selector(openSetup), keyEquivalent: ""); tools.target = self
        sub(L("View", "Zobrazení"), [reload, tools])
        sub(L("Window", "Okno"), [NSMenuItem(title: L("Close Window", "Zavřít okno"), action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"),
                     NSMenuItem(title: L("Minimize", "Minimalizovat"), action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")])
        NSApp.mainMenu = main
    }
    @objc func reloadPage() { if serverUp { web.load(URLRequest(url: pageURL())) } }
    func pageURL() -> URL {
        var c = URLComponents(url: server.url, resolvingAgainstBaseURL: false)!
        let d = UserDefaults.standard
        for k in ["view", "repo", "guest", "n", "repos"] { if let v = d.string(forKey: k) { c.queryItems?.append(URLQueryItem(name: k, value: v)) } }
        if let o = d.string(forKey: "open") { c.queryItems?.append(URLQueryItem(name: "open", value: o)) }
        if d.bool(forKey: "demo") { c.queryItems?.append(URLQueryItem(name: "demo", value: "1")) }
        return c.url!
    }


    func buildStatusItem() {
        statusItem.button?.image = menuBarIcon(.idle)
        let m = NSMenu()
        let open = NSMenuItem(title: L("Open Agent Office", "Otevřít Agent Office"), action: #selector(openFromMenu), keyEquivalent: ""); open.target = self
        m.addItem(open); statusLine.isEnabled = false; m.addItem(statusLine); m.addItem(.separator())
        m.addItem(NSMenuItem(title: L("Quit", "Ukončit"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = m
    }
    @objc func openFromMenu() { showWindow() }

    // polling → status icon + notifications
    /// Test hook: write a path into $AGENT_OFFICE_SNAP_DIR/snap.req and the web view is saved there as PNG (no focus needed).
    func startSnapHook() {
        guard let dir = ProcessInfo.processInfo.environment["AGENT_OFFICE_SNAP_DIR"] else { return }
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            let req = URL(fileURLWithPath: dir).appendingPathComponent("snap.req")
            guard let out = try? String(contentsOf: req, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines), !out.isEmpty else { return }
            try? FileManager.default.removeItem(at: req)
            self.web.takeSnapshot(with: nil) { img, _ in
                guard let img = img, let t = img.tiffRepresentation, let rep = NSBitmapImageRep(data: t), let png = rep.representation(using: .png, properties: [:]) else { return }
                try? png.write(to: URL(fileURLWithPath: out))
            }
        }
    }
    func startPolling() {
        startSnapHook()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in self.poll() }
        poll()
    }
    func poll() {
        var r = URLRequest(url: URL(string: "http://127.0.0.1:\(server.port)/api/state?t=\(server.token)")!); r.timeoutInterval = 3
        URLSession.shared.dataTask(with: r) { data, _, _ in
            guard let data = data, let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let ps = j["projects"] as? [[String: Any]] else { return }
            DispatchQueue.main.async { self.apply(ps) }
        }.resume()
    }
    func apply(_ ps: [[String: Any]]) {
        var running = 0, waiting = 0, done = 0
        var questions: [Question] = []
        for p in ps {
            let st = p["status"] as? String ?? ""
            let id = p["id"] as? String ?? ""
            if st == "running" { running += 1 }
            if st == "waiting_user" { running += 1 }
            if st == "done" { done += 1 }
            for q in (p["inbox"] as? [[String: Any]]) ?? [] where q["answer"] is NSNull || q["answer"] == nil {
                waiting += 1
                questions.append(Question(projectId: id, repo: p["repoName"] as? String ?? "", id: q["id"] as? String ?? "", text: q["text"] as? String ?? "", options: q["options"] as? [String] ?? []))
            }
            if (st == "done" || st == "error" || st == "budget"), !finishedNotified.contains(id + st) {
                if finishedNotified.isEmpty && !notifiedOnce { finishedNotified.insert(id + st) } // don't replay old projects at launch
                else { finishedNotified.insert(id + st); notifyFinished(p, st) }
            }
        }
        notifiedOnce = true
        runningCount = running
        let status: Status = waiting > 0 ? .waiting : running > 0 ? .working : done > 0 ? .done : .idle
        statusItem.button?.image = menuBarIcon(status)
        statusItem.button?.title = waiting > 0 ? " \(waiting)" : ""
        NSApp.dockTile.badgeLabel = waiting > 0 ? "\(waiting)" : nil
        statusLine.title = waiting > 0 ? L("Waiting for you: \(waiting) question(s)", "Čeká na tebe: \(waiting) otázek") : running > 0 ? L("Working: \(running) project(s)", "Pracuje: \(running) projekt(ů)") : L("Nothing running", "Nic neběží")
        postQuestions(questions)
    }
    var notifiedOnce = false

    func postQuestions(_ qs: [Question]) {
        let fresh = qs.filter { !notified.contains($0.id) }
        guard !fresh.isEmpty else { return }
        let center = UNUserNotificationCenter.current()
        center.getNotificationCategories { existing in
            var cats = existing
            for q in fresh {
                let actions = q.options.prefix(4).enumerated().map { UNNotificationAction(identifier: "opt.\($0.offset)", title: String($0.element.prefix(40)), options: []) }
                cats.insert(UNNotificationCategory(identifier: "q.\(q.id)", actions: Array(actions), intentIdentifiers: [], options: []))
            }
            center.setNotificationCategories(cats)
            for q in fresh {
                self.notified.insert(q.id)
                let c = UNMutableNotificationContent()
                c.title = q.repo.isEmpty ? L("The boss is asking", "Boss se ptá") : L("The boss is asking", "Boss se ptá") + " · \(q.repo)"; c.body = q.text; c.sound = .default
                c.categoryIdentifier = "q.\(q.id)"
                c.userInfo = ["pid": q.projectId, "qid": q.id, "options": q.options]
                center.add(UNNotificationRequest(identifier: "q-\(q.id)", content: c, trigger: nil))
            }
        }
    }
    func notifyFinished(_ p: [String: Any], _ st: String) {
        let c = UNMutableNotificationContent()
        let rn = p["repoName"] as? String ?? ""
        c.title = (st == "done" ? L("Goal done", "Cíl hotov") : L("Goal ended (\(st))", "Cíl skončil (\(st))")) + (rn.isEmpty ? "" : " · \(rn)")
        c.body = (p["goal"] as? String ?? "").prefix(120).description
        c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "fin-\(p["id"] ?? "")-\(st)", content: c, trigger: nil))
    }

    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification, withCompletionHandler h: @escaping (UNNotificationPresentationOptions) -> Void) { h([.banner, .sound, .list]) }
    func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse, withCompletionHandler h: @escaping () -> Void) {
        let u = r.notification.request.content.userInfo
        if r.actionIdentifier.hasPrefix("opt."), let i = Int(r.actionIdentifier.dropFirst(4)), let opts = u["options"] as? [String], i < opts.count, let pid = u["pid"] as? String, let qid = u["qid"] as? String {
            var req = URLRequest(url: URL(string: "http://127.0.0.1:\(server.port)/api/projects/\(pid)/answer?t=\(server.token)")!)
            req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["qid": qid, "value": opts[i]])
            URLSession.shared.dataTask(with: req) { _, _, _ in DispatchQueue.main.async { self.poll() } }.resume()
        } else { DispatchQueue.main.async { self.showWindow() } }
        h()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
