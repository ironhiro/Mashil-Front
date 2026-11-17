/**
 * Sentry environment 이름. 같은 웹 빌드가 개발 서버에서 확인된 뒤 그대로 운영으로 승격되므로 (docs/RELEASE.md)
 * 빌드 변수로는 나눌 수 없고, 접속한 호스트로 정한다. 이름은 백엔드 Sentry__Environment 와 같다
 * (deploy/azure/provision.sh: production / development).
 * 목록에 없는 호스트(로컬 등)는 VITE_SENTRY_ENVIRONMENT, 그것도 없으면 Vite 모드.
 */
const BY_HOST: Record<string, string> = {
    "toilets.ironhiro.dev": "production",
    "toilets-dev.ironhiro.dev": "development",
};

export function sentryEnvironment(host: string = window.location.hostname): string {
    return BY_HOST[host.toLowerCase()] ?? (import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE);
}
