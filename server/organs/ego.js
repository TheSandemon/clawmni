const { Octokit } = require('@octokit/rest');

async function triggerTaskBreakdown(ideationList, apiKey) {
    try {
        const systemPrompt = `You are Clawmni OS Ego, the executive function responsible for filtering and breaking down ideas into actionable tasks.
You are given a list of brainstormed ideas. Your job is to select the SINGLE BEST, most coherent technical approach from the list.
CRITICAL: You MUST respond ONLY with a valid JSON block containing:
- "selected_idea": The exact string of the idea you chose from the list.
- "difficulty": "Low", "Medium", or "High".
- "importance": "Low", "Medium", or "High".
- "plan": A markdown string containing a concrete checklist of technical execution steps.`;

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
                    { "role": "user", "content": ideationList }
                ]
            })
        });
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || "";

        // Extract JSON using regex
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0].trim());
        }
        return null;
    } catch (error) {
        console.error("[Ego] Minimax API Error:", error);
        return null;
    }
}

module.exports = function (db) {
    console.log("[Setup] Ego organ connected.");
    db.ref('system/organ_ego_status').set('Idle');

    // --- THE EGO (Executive Function) ---
    db.ref('pulse_execute').on('value', async (snapshot) => {
        if (!snapshot.exists()) return;

        // Fetch dynamic repo target
        const repoSnap = await db.ref('config/target_repo').once('value');
        const repoConfig = repoSnap.val();
        if (!repoConfig || !repoConfig.owner || !repoConfig.repo) return;

        const REPO_OWNER = repoConfig.owner;
        const REPO_NAME = repoConfig.repo;
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        db.ref('system/organ_ego_status').set('Filtering Ideas...');
        console.log("[Ego] Pulse received. Checking for untriaged ideations in bloodstream...");
        try {
            // First, fetch config to get max tasks
            const configSnap = await db.ref('config').once('value');
            const config = configSnap.val() || {};
            const maxTasks = config.max_tasks || 1;

            // Check how many open EGO TASK issues exist
            const { data: openIssues } = await octokit.issues.listForRepo({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                state: 'open'
            });

            const currentEgoTasks = openIssues.filter(issue => issue.title.startsWith('[EGO TASK]')).length;

            if (currentEgoTasks >= maxTasks) {
                console.log(`[Ego] Throttled: ${currentEgoTasks} active tasks exist (Max allowed: ${maxTasks}). Sleeping...`);
                db.ref('system/organ_ego_status').set('Sleeping (Task Limit Reached)');
                return;
            }

            // Fetch ideas from Bloodstream
            const poolSnap = await db.ref('ideas/pool').once('value');
            const poolData = poolSnap.val();

            if (!poolData) {
                db.ref('system/organ_ego_status').set('Idle');
                return;
            }

            // poolData is an object with Firebase push keys: { "-Oxyz...": "Idea string", ... }
            const ideaKeys = Object.keys(poolData);
            const ideaValues = Object.values(poolData);

            if (ideaKeys.length === 0) {
                db.ref('system/organ_ego_status').set('Idle');
                return;
            }

            console.log(`[Ego] Triaging a batch of ${ideaValues.length} ideas from the pool...`);
            db.ref('system/organ_ego_status').set(`Triaging ${ideaValues.length} Ideas`);

            if (process.env.OPENROUTER_API_KEY) {
                const breakdown = await triggerTaskBreakdown(ideaValues.join('\n'), process.env.OPENROUTER_API_KEY);

                if (breakdown && breakdown.selected_idea && breakdown.plan) {
                    const taskIssue = await octokit.issues.create({
                        owner: REPO_OWNER,
                        repo: REPO_NAME,
                        title: `[EGO TASK] ${breakdown.selected_idea}`,
                        body: `### Ego Execution Plan\n\n**Difficulty:** ${breakdown.difficulty} | **Importance:** ${breakdown.importance}\n\n${breakdown.plan}\n\n---\n_Auto-generated by Clawmni OS Ego Organ_`
                    });

                    // Optionally tag the repo issues with labels if they exist
                    try {
                        await octokit.issues.addLabels({
                            owner: REPO_OWNER,
                            repo: REPO_NAME,
                            issue_number: taskIssue.data.number,
                            labels: [breakdown.difficulty, breakdown.importance]
                        });
                    } catch (e) { } // Ignore if labels don't exist

                    console.log(`[Ego] Created new Task #${taskIssue.data.number} for idea: ${breakdown.selected_idea}`);

                    // Log activity
                    db.ref('system/activity').push({
                        type: 'task',
                        message: `Created task #${taskIssue.data.number}: ${breakdown.selected_idea}`,
                        timestamp: Date.now()
                    });

                    // Remove the selected idea from the Firebase pool
                    // Find the key corresponding to this idea to delete it
                    const selectedKey = ideaKeys.find(key => poolData[key] === breakdown.selected_idea);
                    if (selectedKey) {
                        await db.ref(`ideas/pool/${selectedKey}`).remove();
                    }

                    // Inject Dopamine and consume Fuel
                    const dopaRef = db.ref('state/dopamine');
                    await dopaRef.transaction(current => Math.min((current || 0) + 10, 100));
                    const fuelRef = db.ref('state/fuel_consumed');
                    await fuelRef.transaction(current => (current || 0) + 1);

                    // Wake up Arms
                    db.ref('pulse_execute').set(Date.now());
                } else {
                    console.log("[Ego] Invalid breakdown response from Minimax. Will retry next pulse.");
                }
            }
            db.ref('system/organ_ego_status').set('Idle');
        } catch (err) {
            console.error("[Ego] Failed executing triage loop:");
            if (err.response) {
                console.error("Status:", err.response.status);
                console.error("Data:", err.response.data);
            } else {
                console.error(err);
            }
            db.ref('system/organ_ego_status').set('Error');
        }
    });
};
