import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.tomotype",
  appName: "ともタイプ",
  webDir: "mobile-dist",
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    backgroundColor: "#fffaf3",
  },
  plugins: {
    LocalNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
