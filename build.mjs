import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  platform: "node",
  target: "ES6",
  dropLabels: ["DEV"],
  bundle: true,
  minify: true,
  external: ["aws-query-decoder", "aws-md5-of-message-attributes"],
});
