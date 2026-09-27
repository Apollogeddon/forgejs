// PostToolUse hook (Edit|Write): runs biome check --fix on a touched src/ file. Unfixable
// diagnostics exit 2 so they're fed back to Claude (plain stdout only reaches the transcript).
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "../..");

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
	// biome.json only includes src/**; biome errors on explicitly passed files outside it
	const relative = path.relative(projectDir, path.resolve(projectDir, file));
	if (!relative.startsWith(`src${path.sep}`)) {
		return;
	}

	try {
		// run biome's JS entry with this node binary: no npx, no shell, safe with any path
		const biome = require.resolve("@biomejs/biome/bin/biome", { paths: [projectDir] });
		execFileSync(process.execPath, [biome, "check", "--fix", relative], { cwd: projectDir, stdio: "pipe" });
	} catch (err) {
		process.stderr.write(`${err.stdout ?? ""}${err.stderr ?? ""}` || String(err));
		process.exit(2);
	}
});
