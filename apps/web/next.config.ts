import { withEve } from "eve/next";
import type { NextConfig } from "next";

const config: NextConfig = {
  // An ngrok tunnel to `next dev`, for trying the MCP server in Claude and ChatGPT.
  allowedDevOrigins: ["*.ngrok-free.app"],
  logging: {
    incomingRequests: { ignore: [/\/api\/auth\/google\/callback/] },
  },
  // Settings moved from /account; links from assistants keep their #anchor.
  // History became Transactions.
  async redirects() {
    return [
      { source: "/account", destination: "/settings", permanent: false },
      { source: "/history", destination: "/activity", permanent: false },
    ];
  },
  // Clients that ask for /favicon.ico get the generated icon (app/icon.tsx);
  // ones that kept the old vector icon's URL get the largest PNG.
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/icon/32" },
      { source: "/icon/svg", destination: "/icon/512" },
    ];
  },
  // JSON endpoints can't carry a robots meta tag.
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      {
        source: "/notifications-sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      { source: "/api/:path*", headers: noindex },
      { source: "/mcp/:path*", headers: noindex },
      { source: "/mcp", headers: noindex },
    ];
  },
  // Crossmint's React SDK bundles wallet connectors (MetaMask, WalletConnect)
  // that reference optional packages we never use. Resolve them to nothing
  // instead of warning on every compile.
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./lib/empty-module.js",
      "pino-pretty": "./lib/empty-module.js",
    },
  },
  webpack(webpackConfig) {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return webpackConfig;
  },
};

export default withEve(config, {
  eveRoot: "../../packages/agent",
  eveBuildCommand: "pnpm build:runtime",
});
