/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // WalletConnect (pulled in by @stacks/connect) references optional deps that
    // we don't use — pino-pretty (dev logger), lokijs, encoding. They're not
    // installed, so webpack prints noisy "Module not found" warnings. Mark them
    // external so the build/console stays clean; they're never actually loaded.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
