import esbuild from "esbuild";

const DEV = process.argv.includes("dev");

const options = {
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  platform: "node",
  target: "ES6",
  dropLabels: DEV ? undefined : ["DEV"],
  bundle: true,
  minify: true,
  external: ["aws-query-decoder", "aws-md5-of-message-attributes"],
};

if (DEV) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
