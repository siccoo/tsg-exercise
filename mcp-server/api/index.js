// Vercel entrypoint: every path is rewritten here (see vercel.json) and the
// Express app handles routing.
import { createApp } from "../src/app.js";

export default createApp();
