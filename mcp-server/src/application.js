import express from "express";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./mcp.js";
import { createPaystackClient } from "./paystack.js";

function bearerMatches(header, expected) {
  const got = Buffer.from(String(header ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

export function createApp({ env = process.env, paystack } = {}) {
  paystack ??= createPaystackClient({
    secretKey: env.PAYSTACK_SECRET_KEY,
    mode: env.PAYSTACK_MODE === "mock" ? "mock" : "live-api",
    publicBaseUrl: env.PUBLIC_BASE_URL,
  });
  const authToken = env.MCP_AUTH_TOKEN;
  if (!authToken)
    console.warn(
      "MCP_AUTH_TOKEN is not set: /mcp is open to anyone who finds the URL.",
    );

  const app = express();
  app.use(express.json({ limit: "100kb" }));

  app.get("/", (_req, res) =>
    res.json({
      service: "mama-t-orders MCP server",
      mcp_endpoint: "/mcp",
      paystack_mode: paystack.mode,
    }),
  );
  app.get("/healthz", (_req, res) =>
    res.json({ ok: true, paystack_mode: paystack.mode }),
  );

  app.use("/mcp", (req, res, next) => {
    if (!authToken || bearerMatches(req.headers.authorization, authToken))
      return next();
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
  });

  // The MCP SDK answers 406 unless Accept lists both application/json and
  // text/event-stream. We always reply with plain JSON, so accept any client
  // (Chord's docs don't state which Accept header it sends).
  app.post("/mcp", (req, _res, next) => {
    const accept = String(req.headers.accept ?? "");
    // Record what the client really sends, so the field notes can cite it.
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        event: "mcp_request",
        method: req.body?.method,
        accept: req.headers.accept ?? null,
        protocol_version: req.headers["mcp-protocol-version"] ?? null,
        user_agent: req.headers["user-agent"] ?? null,
      }),
    );
    if (
      !(
        accept.includes("application/json") &&
        accept.includes("text/event-stream")
      )
    ) {
      const value = "application/json, text/event-stream";
      req.headers.accept = value;
      const raw = [];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i].toLowerCase() !== "accept")
          raw.push(req.rawHeaders[i], req.rawHeaders[i + 1]);
      }
      req.rawHeaders = [...raw, "Accept", value];
    }
    next();
  });

  // Stateless Streamable HTTP: a fresh server + transport per request, plain JSON
  // responses. Nothing is held in memory between calls, so it runs on serverless.
  app.post("/mcp", async (req, res) => {
    const server = buildMcpServer({
      paystack,
      placeholderEmailDomain: env.PLACEHOLDER_EMAIL_DOMAIN,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request failed", err);
      if (!res.headersSent)
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
    }
  });

  const methodNotAllowed = (_req, res) =>
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST." },
      id: null,
    });
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  // Fake checkout page, only in mock mode, so a local demo can "pay".
  if (paystack.mode === "mock") {
    app.get("/mock-pay/:ref", (req, res) => {
      const { ref } = req.params;
      const outcome = req.query.outcome;
      if (outcome === "success" || outcome === "failed") {
        const found = paystack.settle(ref, outcome);
        return res.send(
          found
            ? `Mock payment for ${ref}: ${outcome}. Go back to WhatsApp.`
            : "Unknown reference",
        );
      }
      res.send(
        `<h1>Mock checkout ${ref}</h1><p><a href="?outcome=success">Pay (success)</a> · <a href="?outcome=failed">Pay (declined)</a></p>`,
      );
    });
  }

  return app;
}
