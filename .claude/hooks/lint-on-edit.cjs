// PostToolUse hook (Edit|Write): runs biome check --fix on the touched
// file for instant feedback, mirroring the repo's `npm run lint` script.
const { execFileSync } = require("child_process");

let input = "";
process.stdin.on("data", (chunk) => {
	input += chunk;
});
process.stdin.on("end", () => {
	let data = {};
	try {
		data = JSON.parse(input);
	} catch {
		return;
	}

	const file = data.tool_input?.file_path || data.tool_response?.filePath;
	if (!file || !/\.(ts|tsx|js|jsx|cjs|mjs|json)$/.test(file)) {
		return;
	}

	try {
		// shell: true so npx resolves on Windows (npx.cmd isn't found by a direct spawn)
		execFileSync("npx", ["biome", "check", "--fix", file], { stdio: "inherit", shell: true });
	} catch {
		// non-blocking: surface nothing further, biome already printed the issue
	}
});
