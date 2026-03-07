const path = require("path");
const { rspack } = require("@rspack/core");

const rootDir = __dirname;
const browserTargets = ["chrome", "firefox"];

function createConfig(browserTarget) {
  return {
    mode: "development",
    devtool: false,
    context: rootDir,
    target: ["web", "es2020"],
    entry: {
      background: ["./src/logging.ts", "./src/background.ts"],
      content: ["./src/logging.ts", "./src/content.ts"],
      popup: ["./src/logging.ts", "./src/popup.ts"],
    },
    output: {
      path: path.join(rootDir, browserTarget, "src"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    optimization: {
      runtimeChunk: false,
      splitChunks: false,
      minimize: false,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
              },
              target: "es2020",
            },
          },
        },
      ],
    },
    plugins: [
      new rspack.CopyRspackPlugin({
        patterns: [
          { from: path.join(rootDir, "src", "popup.html"), to: "popup.html" },
          { from: path.join(rootDir, "src", "popup.css"), to: "popup.css" },
          { from: path.join(rootDir, "src", "content.css"), to: "content.css" },
        ],
      }),
    ],
  };
}

module.exports = browserTargets.map(createConfig);
