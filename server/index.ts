import { spawn } from "child_process";
import * as path from "path";

const pythonServer = spawn("python3", [path.resolve(process.cwd(), "server_py", "main.py")], {
  stdio: "inherit",
  env: process.env,
});

pythonServer.on("error", (err) => {
  console.error("Failed to start Python server:", err);
  process.exit(1);
});

pythonServer.on("close", (code) => {
  console.log(`Python server exited with code ${code}`);
  process.exit(code || 0);
});

process.on("SIGTERM", () => pythonServer.kill("SIGTERM"));
process.on("SIGINT", () => pythonServer.kill("SIGINT"));
