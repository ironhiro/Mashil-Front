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
        build: {
            rollupOptions: {
                output: {
                    // 잘 바뀌지 않는 라이브러리를 따로 묶는다. 앱 코드만 고친 배포에서는 이 파일들을 웹뷰가 캐시에서 다시 쓴다
                    manualChunks(id: string) {
                        if (!id.includes("node_modules")) return undefined;
                        if (/node_modules[\/](react|react-dom|scheduler|react-router|react-router-dom)[\/]/.test(id)) return "vendor-react";
                        if (/node_modules[\/](@mui|@emotion)[\/]/.test(id)) return "vendor-mui";
                        return undefined;
                    },
                },
            },
        },
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
