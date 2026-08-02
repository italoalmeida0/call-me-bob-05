import { serve } from "bun";

import app from "./index.html";

const port = Number(Bun.argv[2] || 5600);

const server = serve({
  routes: {
    "/": app,
  },

  async fetch(req) {
    const url = new URL(req.url);

    try {
      const file = Bun.file(`.${decodeURIComponent(url.pathname)}`);
      if (!(await file.exists())) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(file);
    } catch (error) {
      console.error(`Error serving file ${url.pathname}:`, error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  development: {
    hmr: false,
    console: true,
  },

  port,
});

console.log(`Server running at ${server.url}`);
