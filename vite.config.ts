import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드 위치는 사람마다 다를 수 있으므로 .env / .env.local 의 VITE_API_PROXY_TARGET 으로 override 가능.
// 기본값은 dotnet run --project src/Mashil.Api 가 띄우는 :5099.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5099";
    const devPort = Number(env.VITE_DEV_PORT) || 5173;

    return {
        plugins: [react()],
        server: {
            port: devPort,
            proxy: {
                "/api": {
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
