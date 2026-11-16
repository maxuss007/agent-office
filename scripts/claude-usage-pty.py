"""Read-only /usage bridge. Claude Code owns authentication; no token handling."""
import os, pty, fcntl, termios, struct, signal, select, sys, time
pid, master = pty.fork()
if pid == 0:
    fcntl.ioctl(1, termios.TIOCSWINSZ, struct.pack('HHHH', 100, 160, 0, 0))
    os.execv(sys.argv[1], [sys.argv[1], '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--settings', '{"disableAllHooks":true}', '/usage'])
def stop(*_):
    raise SystemExit(0)
signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
try:
    until = time.monotonic() + 12
    while time.monotonic() < until:
        if select.select([master], [], [], 0.2)[0]:
            try: data = os.read(master, 65536)
            except OSError: break
            if not data: break
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
finally:
    try: os.kill(pid, signal.SIGTERM)
    except ProcessLookupError: pass
    os.close(master)
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        try:
            if os.waitpid(pid, os.WNOHANG)[0]: break
        except ChildProcessError: break
        time.sleep(0.05)
    else:
        try: os.kill(pid, signal.SIGKILL)
        except ProcessLookupError: pass
        try: os.waitpid(pid, 0)
        except ChildProcessError: pass
