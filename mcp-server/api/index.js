// Vercel entrypoint: every path is rewritten here (see vercel.json) and the
// Express app handles routing.
import { createApp } from "../src/application.js";

export default createApp();
