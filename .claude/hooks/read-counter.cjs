// PreToolUse hook (Read|Grep): counts calls per session, nudges toward
// spawning a Haiku Explore agent past the threshold set in CLAUDE.md.
const os = require("os");
const path = require("path");
const fs = require("fs");

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

	const firstWarning = count === 3;
	const repeatWarning = count > 3 && (count - 3) % 5 === 0;
	if (firstWarning || repeatWarning) {
		process.stdout.write(
			JSON.stringify({
				systemMessage: `Read/Grep call #${count} this session — CLAUDE.md says to delegate multi-file exploration to a Haiku Explore agent instead of reading directly.`,
			}),
		);
	}
});
