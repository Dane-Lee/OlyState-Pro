import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootArg = process.argv[2] ?? "dist";
const root = resolve(process.cwd(), rootArg);
const port = Number(process.env.PORT ?? 4173);
const host = "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function getFilePath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const candidate = resolve(root, safePath);
  if (!candidate.startsWith(root)) {
    return join(root, "index.html");
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return join(root, "index.html");
}

const server = createServer((request, response) => {
  const filePath = getFilePath(request.url ?? "/");
  const ext = extname(filePath);
  response.setHeader("Content-Type", mimeTypes[ext] ?? "application/octet-stream");
  createReadStream(filePath)
    .on("error", () => {
      response.statusCode = 404;
      response.end("Not found");
    })
    .pipe(response);
});

server.listen(port, host, () => {
  const self = fileURLToPath(import.meta.url);
  console.log(`OlyState Pro preview serving ${root} at http://${host}:${port}/`);
  console.log(`Server: ${self}`);
});
