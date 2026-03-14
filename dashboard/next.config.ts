import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.HIVE_NEXT_DIR || '.next',
};

export default nextConfig;
