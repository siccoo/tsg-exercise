// Local entrypoint: `npm start` (or `npm run dev` for mock Paystack).
import { createApp } from "./src/app.js";

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => console.log(`MCP server listening on http://localhost:${port}/mcp`));
