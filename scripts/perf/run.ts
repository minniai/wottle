import { spawn } from "child_process";
import { APP_PORT } from "../../lib/constants/app";

// Wrapper script to run artillery with the correct APP_PORT
const args = process.argv.slice(2);

console.log(`Running artillery with APP_PORT=${APP_PORT}`);

const env = { ...process.env, APP_PORT: String(APP_PORT) };

const child = spawn("artillery", args, { env, stdio: "inherit" });

child.on("close", (code) => {
    process.exit(code ?? 0);
});
