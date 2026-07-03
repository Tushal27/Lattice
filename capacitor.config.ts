import type { CapacitorConfig } from "@capacitor/cli";

// Native Android shell for Lattice. It doesn't re-implement the UI — it loads
// the live app in a native WebView and adds native powers on top (starting with
// background SMS capture; push, share-target, widgets, etc. can follow).
//
// `server.url` points the shell at the deployed app, so all server rendering and
// API routes keep working exactly as on the web. To develop against a local dev
// server instead, set CAP_SERVER_URL=http://192.168.x.x:3000 before `cap sync`.
const config: CapacitorConfig = {
  appId: "app.lattice.mobile",
  appName: "Lattice",
  webDir: "native/www",
  server: {
    url: process.env.CAP_SERVER_URL || "https://lattice-pink.vercel.app",
    cleartext: Boolean(process.env.CAP_SERVER_URL), // allow http only for local dev
  },
  android: {
    backgroundColor: "#0a0a0b",
  },
};

export default config;
