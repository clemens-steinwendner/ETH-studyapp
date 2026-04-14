import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";

const nextConfig = {
  // Extend proxy timeout to 3 minutes — LLM topic generation can take >30s
  experimental: {
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ["python", "sql", "haskell", "latex"],
          filename: "static/[name].worker.js",
        })
      );
    }
    return config;
  },
};

export default nextConfig;
