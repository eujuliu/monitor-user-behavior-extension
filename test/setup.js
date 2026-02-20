const http = require("http");
const fs = require("fs");
const path = require("path");

let server;
let serverUrl;

const serverCallback = (req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = path.join(
    process.cwd(),
    req.url === "/" ? "/test/test.html" : req.url,
  );

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const content = fs.readFileSync(filePath);
  const ext = path.extname(filePath);
  const contentType = ext === ".html" ? "text/html" : "text/plain";

  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
};

beforeAll(() => {
  return new Promise((resolve) => {
    server = http.createServer(serverCallback);
    server.listen(0, () => {
      serverUrl = `http://localhost:${server.address().port}`;
      global.testServerUrl = serverUrl;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
});

function getServerUrl() {
  return global.testServerUrl;
}

module.exports = { getServerUrl };
