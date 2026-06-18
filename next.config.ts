import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: se carga desde node_modules en runtime
  // (no se empaqueta). Lo usa el Data Warehouse en SQLite vía /api/dw/query.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
