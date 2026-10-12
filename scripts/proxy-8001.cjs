// Minimal reverse proxy: the Emergent ingress routes "/api/*" to port 8001 and
// everything else to 3000, but TaxHacker is a single Next.js server on 3000.
// This forwards 8001 -> 3000 (including websocket upgrades for dev HMR) so the
// Next.js app's own /api/* route handlers work through the preview URL.
const http = require("http")
const net = require("net")

const TARGET_HOST = "127.0.0.1"
const TARGET_PORT = 3000
const LISTEN_PORT = 8001

const server = http.createServer((req, res) => {
  const options = {
    host: TARGET_HOST,
    port: TARGET_PORT,
    method: req.method,
    path: req.url,
    headers: req.headers,
  }
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })
  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" })
    res.end("Bad gateway")
  })
  req.pipe(proxyReq, { end: true })
})

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headerLines = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`)
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines.join("\r\n")}\r\n\r\n`)
    if (head && head.length) upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  upstream.on("error", () => socket.destroy())
  socket.on("error", () => upstream.destroy())
})

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`api proxy listening on ${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`)
})
