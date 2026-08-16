import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// GitHub Pages のサブパス。manifest 以外に <link> のパスもここで揃える
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "My Dashboard",
  description: "AI・コールセンタ・システム・ゲーム・話題のニュースを1画面に集約する個人ダッシュボード",
  applicationName: "My Dashboard",
  // iOS はホーム画面に追加したときの見た目を manifest ではなく meta で決める
  appleWebApp: {
    capable: true,
    title: "Dashboard",
    // ステータスバーを背景に溶け込ませる。safe-area の padding とセットで使う
    statusBarStyle: "black-translucent",
  },
  icons: {
    // metadata の URL には basePath が自動で付かないので明示する
    apple: `${basePath}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  // ノッチ端末で画面の端まで描く。切り欠きの回避は safe-area-inset で行う
  viewportFit: "cover",
  // ピンチズームは塞がない（アプリ風の見た目より読めることを優先する）
  initialScale: 1,
  width: "device-width",
  // スタンドアロン起動時のステータスバー色。背景色と一致させて継ぎ目を消す
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e11" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning は next-themes が必須とする。
    // テーマ適用のため <html> の class をスクリプトが描画前に書き換えるので、
    // ここだけサーバー/クライアントの差分を許容する。
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
