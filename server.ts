const root = import.meta.dir;

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    if (path.includes("..")) return new Response("Bad Request", { status: 400 });

    const file = Bun.file(`${root}${path}`);

    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
