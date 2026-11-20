#!/usr/bin/env node
/**
 * 브라우저로 새어 나가는 값을 막는 검사 (CI: 빌드 뒤에 `node tool/check-env.mjs dist`).
 *
 * Vite 는 VITE_ 로 시작하는 변수를 .env 파일뿐 아니라 셸·CI 환경에서도 읽어 번들에 평문으로 넣는다.
 * .gitignore 는 git 에 안 올릴 뿐이라 VITE_ 값은 "공개 설정"이다. 비밀(API 키, 토큰, 비밀번호)은 백엔드에만 둔다.
 *
 * 소스 검사
 *   1. import.meta.env 는 이름을 바로 붙여서만 읽는다 (import.meta.env.VITE_X).
 *      객체째 쓰거나 env[key] 로 읽으면 빌드할 때 있던 VITE_ 변수가 쓰든 안 쓰든 전부 번들에 들어간다.
 *   2. 읽는 VITE_ 이름은 src/vite-env.d.ts 에 선언된 것만 (= 공개돼도 되는 값의 목록). 새로 더할 때 거기서 검토한다.
 *   3. 이름에 SECRET·TOKEN·PASSWORD 같은 말이 든 VITE_ 변수는 선언해도 안 된다.
 *   4. vite.config.ts 에서 envPrefix 변경, define 에 process.env, 소스맵 공개를 하지 않는다.
 * 빌드 결과 검사 (인자로 dist 폴더를 주면)
 *   5. VITE_ 변수 객체가 통째로 들어 있으면 실패 (1 을 우회한 경우).
 *   6. 비밀처럼 생긴 문자열(개인 키, JWT, GitHub·AWS·Anthropic·OpenAI 키, DB 연결 문자열)이 있으면 실패.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname, resolve } from "node:path";

const root = process.cwd();
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir, exts) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p, exts));
        else if (exts.includes(extname(p))) out.push(p);
    }
    return out;
}

const rel = (p) => relative(root, p).replaceAll("\\", "/");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// ---- 공개 목록 (vite-env.d.ts)
const dtsPath = join(root, "src", "vite-env.d.ts");
const declared = new Set([...readFileSync(dtsPath, "utf8").matchAll(/readonly\s+(VITE_[A-Z0-9_]+)\??\s*:/g)].map((m) => m[1]));
const FORBIDDEN_NAME = /SECRET|TOKEN|PASSW|PRIVATE|CREDENTIAL|REST_API|ADMIN/;
for (const name of declared) {
    if (FORBIDDEN_NAME.test(name)) fail(`src/vite-env.d.ts: ${name} — 비밀로 보이는 이름은 VITE_ 로 두지 않는다 (백엔드로 옮길 것)`);
}

// ---- 소스
for (const file of walk(join(root, "src"), [".ts", ".tsx", ".js", ".jsx", ".mjs"])) {
    if (file.endsWith(".d.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/import\.meta\.env(?!\s*\.\s*[A-Za-z_$])/g)) {
        fail(`${rel(file)}:${lineOf(text, m.index)} — import.meta.env 를 객체째 쓰지 말고 import.meta.env.VITE_이름 으로 읽는다 (안 쓰는 VITE_ 변수까지 번들에 들어간다)`);
    }
    for (const m of text.matchAll(/import\.meta\.env\s*\.\s*(VITE_[A-Z0-9_]+)/g)) {
        if (!declared.has(m[1])) fail(`${rel(file)}:${lineOf(text, m.index)} — ${m[1]} 이 src/vite-env.d.ts 에 없다. 브라우저에 공개돼도 되는 값인지 확인하고 선언한다`);
    }
}

// ---- vite 설정
for (const name of ["vite.config.ts", "vite.config.js", "vite.config.mts"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    if (/\benvPrefix\b/.test(text)) fail(`${name}: envPrefix 를 바꾸지 않는다 (VITE_ 가 아닌 변수까지 번들에 들어갈 수 있다)`);
    if (/\bdefine\s*:/.test(text) && /process\.env/.test(text)) fail(`${name}: define 에 process.env 를 넣지 않는다`);
    if (/sourcemap\s*:\s*(true|["']inline["'])/.test(text)) fail(`${name}: 운영 빌드에 공개 소스맵을 켜지 않는다`);
}

// ---- 빌드 결과
const distArg = process.argv[2];
if (distArg) {
    const dist = resolve(root, distArg);
    if (!existsSync(dist)) {
        fail(`${distArg} 가 없다 (빌드 뒤에 실행)`);
    } else {
        const SECRET_PATTERNS = [
            [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "개인 키"],
            [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT"],
            [/\bsk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic API 키"],
            [/\bsk-(proj-)?[A-Za-z0-9_-]{32,}/, "OpenAI API 키"],
            [/\bgh[pousr]_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/, "GitHub 토큰"],
            [/\bAKIA[0-9A-Z]{16}\b/, "AWS 키"],
            [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "Slack 토큰"],
            [/Password=[^;"'\s]+;/i, "DB 연결 문자열"],
        ];
        for (const file of walk(dist, [".js", ".mjs", ".html", ".css", ".json", ".map", ".txt"])) {
            const text = readFileSync(file, "utf8");
            const obj = text.match(/[{,]\s*["']?VITE_[A-Z0-9_]+["']?\s*:/);
            if (obj) fail(`${rel(file)} — VITE_ 변수 객체가 통째로 들어 있다 (import.meta.env 를 객체째 쓰는 코드를 찾을 것)`);
            for (const [re, label] of SECRET_PATTERNS) {
                const m = text.match(re);
                if (m) fail(`${rel(file)} — ${label}로 보이는 문자열: ${m[0].slice(0, 8)}…`);
            }
        }
    }
}

if (errors.length) {
    console.error(`check-env: ${errors.length}개 문제\n` + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
}
console.log(`check-env: 통과 (공개 VITE_ 변수 ${declared.size}개${distArg ? `, ${distArg} 검사함` : ""})`);
