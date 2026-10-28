import process from "node:process";
import path from "node:path";

// Produção: esbuild gera dist/index.cjs — import.meta.url fica vazio no formato CJS.
// process.cwd() = WORKDIR (/app no Docker) ou raiz do projeto no npm start local.
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // .env opcional (CI/produção injeta vars no ambiente)
}

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupWebSocket } from "./socket";
import { formatResponseBodyLogFragment } from "./lib/log-summary";

const app = express();
const httpServer = createServer(app);
setupWebSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "rsv360-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += formatResponseBodyLogFragment(capturedJsonResponse, {
          production: process.env.NODE_ENV === "production",
          statusCode: res.statusCode,
        });
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // 0.0.0.0: necessário no Docker (publish de porta). 127.0.0.1 quebra o host→container.
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // Observação de heap pós-OOM (16/07): só via `npm run dev:heap` (HEAP_MONITOR=1).
  // Não altera `npm run dev` nem produção. `.unref()` evita manter o processo vivo só pelo timer.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.HEAP_MONITOR === "1"
  ) {
    const toMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
    setInterval(() => {
      const m = process.memoryUsage();
      log(
        `rss=${toMb(m.rss)}MB heapUsed=${toMb(m.heapUsed)}MB heapTotal=${toMb(m.heapTotal)}MB external=${toMb(m.external)}MB`,
        "heap",
      );
    }, 60_000).unref();
    log("heap monitor on (every 60s)", "heap");
  }
})();
