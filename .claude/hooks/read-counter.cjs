// PostToolUse hook (Read|Grep|Glob): counts calls per session and, past a threshold,
// injects a nudge into Claude's context (a plain systemMessage would only reach the user).
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const WARNING_THRESHOLD = 10;
const WARNING_INTERVAL = 8;

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

	const sessionId = data.session_id || "default";
	const countFile = path.join(os.tmpdir(), `claude-forgejs-readcount-${sessionId}`);

	let count = 0;
	try {
		count = parseInt(fs.readFileSync(countFile, "utf8"), 10) || 0;
	} catch {
		count = 0;
	}
	count += 1;
	fs.writeFileSync(countFile, String(count));

	const firstWarning = count === WARNING_THRESHOLD;
	const repeatWarning = count > WARNING_THRESHOLD && (count - WARNING_THRESHOLD) % WARNING_INTERVAL === 0;
	if (firstWarning || repeatWarning) {
		process.stdout.write(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "PostToolUse",
					additionalContext: `Read/Grep/Glob call #${count} this session. If you are still searching rather than working on files you will edit, delegate the rest of the search to an Explore agent.`,
				},
			}),
		);
	}
});
