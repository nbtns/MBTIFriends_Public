import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ともタイプ",
    short_name: "ともタイプ",
    description: "MBTIと生年月日から分かる星座・年齢をQRで交換できる、アカウント不要の友達ノート。",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#fffaf3",
    lang: "ja",
  };
}
