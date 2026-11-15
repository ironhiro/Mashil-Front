import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드 위치는 사람마다 다를 수 있으므로 .env / .env.local 의 VITE_API_PROXY_TARGET 으로 override 가능.
// 기본값은 dotnet run --project src/Mashil.Api 가 띄우는 :5099.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5099";
    const devPort = Number(env.VITE_DEV_PORT) || 5173;
    // 터널(예: .trycloudflare.com)로 밖에서 개발 서버를 열 때만, 쉼표로 구분한 호스트를 .env.local 에 둔다
    const allowedHosts = env.VITE_ALLOWED_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean);

    return {
        plugins: [react()],
        server: {
            port: devPort,
            allowedHosts: allowedHosts?.length ? allowedHosts : undefined,
            proxy: {
                "/api": {
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
