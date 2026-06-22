import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lattice — your personal operating system",
    short_name: "Lattice",
    description:
      "Capture decisions, lessons, aha moments, questions, and projects. Reflect, connect, and let your knowledge compound over years.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    categories: ["productivity", "lifestyle", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Capture", short_name: "Capture", url: "/capture" },
      { name: "Daily Review", short_name: "Review", url: "/review" },
      { name: "Knowledge Graph", short_name: "Graph", url: "/graph" },
    ],
    // Lets Lattice receive shared text/links from any app's share sheet — the
    // OS routes the share to /share?title=…&text=…&url=… as a GET.
    share_target: {
      action: "/share",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
