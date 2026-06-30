import type { MetadataRoute } from "next";

// Private app: disallow all crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
