const { Octokit } = require('@octokit/rest');

async function triggerAudit(files, apiKey) {
    try {
        const systemPrompt = `You are Clawmni OS Nose, the codebase auditor.
Your job is to sniff out placeholder code, logical errors, unsecured API keys, and security risks in the provided files.
Analyze the code and return EXACTLY 1 to 5 specific, actionable findings.
CRITICAL: You MUST respond ONLY with a Markdown numbered list of findings. No introductions, no conclusions, just the numbered list.
Example:
1. Hardcoded API key found in src/config.js line 12. Move to environment variables.
2. Unnecessary console.log left in src/auth.js.
3. Potential SQL injection vulnerability in db_query() in src/database.js.`;

        let fileDocs = "";
        for (const f of files) {
            fileDocs += `--- File: ${f.path} ---\n${f.content}\n\n`;
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://clawmni.local",
                "X-Title": "Clawmni OS"
            },
            body: JSON.stringify({
                "model": "minimax/MiniMax-M2.5",
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": fileDocs }
                ]
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error) {
        console.error("[Nose] Minimax API Error:", error);
        return "";
    }
}

module.exports = function (db) {
    console.log("[Setup] Nose organ connected. Sniffing for issues.");
    db.ref('system/organ_nose_status').set('Idle');

    // --- THE NOSE (Code Auditor) ---
    // Trigger on pulse, but only execute rarely or when BP is low
    db.ref('pulse').on('value', async (snapshot) => {
        if (!snapshot.exists()) return;

        // Fetch current state and config
        const stateSnap = await db.ref('state').once('value');
        const state = stateSnap.val() || {};
        const configSnap = await db.ref('config').once('value');
        const config = configSnap.val() || {};

        const currentBP = state.blood_pressure !== undefined ? state.blood_pressure : 1.0;

        // Only run audit if BP is very low (system has plenty of time and fuel)
        if (currentBP > 0.8) {
            return; // Too busy to audit right now
        }

        // Only run every ~30 pulses (or if explicitly triggered)
        const lastAudit = state.last_audit || 0;
        const now = Date.now();
        // roughly every hour at 1 min pulse, but for testing we can make it every 5 minutes (300000ms)
        if (now - lastAudit < 300000) {
            return;
        }

        const repoConfig = config.target_repo;
        if (!repoConfig || !repoConfig.owner || !repoConfig.repo) return;

        const REPO_OWNER = repoConfig.owner;
        const REPO_NAME = repoConfig.repo;
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        console.log(`[Nose] BP is low (${currentBP.toFixed(2)}). Sniffing codebase...`);
        db.ref('system/organ_nose_status').set(`Sniffing ${REPO_OWNER}/${REPO_NAME}`);

        try {
            // Get repository default branch
            const { data: repoData } = await octokit.repos.get({ owner: REPO_OWNER, repo: REPO_NAME });
            const branch = repoData.default_branch;

            // Get root tree recursively
            const { data: treeData } = await octokit.git.getTree({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                tree_sha: branch,
                recursive: "1"
            });

            // Filter for code files
            const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.md'];
            const validFiles = treeData.tree.filter(item =>
                item.type === 'blob' &&
                codeExtensions.some(ext => item.path.endsWith(ext)) &&
                !item.path.includes('node_modules') &&
                !item.path.includes('dist') &&
                !item.path.includes('build')
            );

            if (validFiles.length === 0) return;

            // Pick 2 random files to sniff
            const numFiles = Math.min(2, validFiles.length);
            const selectedFiles = [];
            for (let i = 0; i < numFiles; i++) {
                const idx = Math.floor(Math.random() * validFiles.length);
                const fileMeta = validFiles.splice(idx, 1)[0];

                // Fetch content
                const { data: fileData } = await octokit.repos.getContent({
                    owner: REPO_OWNER,
                    repo: REPO_NAME,
                    path: fileMeta.path
                });

                if (fileData.encoding === 'base64') {
                    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                    selectedFiles.push({ path: fileMeta.path, content });
                }
            }

            if (selectedFiles.length > 0 && process.env.OPENROUTER_API_KEY) {
                console.log(`[Nose] Sending ${selectedFiles.length} files to Minimax for audit...`);
                const auditFindings = await triggerAudit(selectedFiles, process.env.OPENROUTER_API_KEY);

                if (auditFindings) {
                    // Turn findings into an ID BATCH issue so Ego picks it up naturally
                    const issueTitle = `[ID BATCH] Code Audit Findings`;

                    const checkboxes = auditFindings.split('\n')
                        .filter(l => l.trim())
                        .map(l => `- [ ] ${l.replace(/^\d+\.\s*/, '')}`)
                        .join('\n');

                    await octokit.issues.create({
                        owner: REPO_OWNER,
                        repo: REPO_NAME,
                        title: issueTitle,
                        body: `### Nose Code Audit\nThe Nose sniffed out the following issues in the codebase:\n\n${checkboxes}\n\n---\n_Auto-generated by Clawmni OS Nose Organ_`
                    });
                    console.log("[Nose] Created Audit Findings issue.");
                }
            }

            // Update timestamp & state
            await db.ref('state/last_audit').set(now);
            const fuelRef = db.ref('state/fuel_consumed');
            await fuelRef.transaction(current => (current || 0) + 1);

            db.ref('system/organ_nose_status').set('Idle');

        } catch (err) {
            console.error("[Nose] Audit cycle failed:", err);
            db.ref('system/organ_nose_status').set('Error');
        }
    });
};
