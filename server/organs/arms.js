module.exports = function (db) {
    console.log("[Setup] Arms organ connected.");
    db.ref('system/organ_arms_status').set('Idle');

    // --- THE ARMS (Task Decomposition & Multi-Finger Execution) ---
    db.ref('pulse_execute').on('value', async (snapshot) => {
        if (!snapshot.exists()) return;

        // Fetch dynamic repo target
        const repoSnap = await db.ref('config/target_repo').once('value');
        const repoConfig = repoSnap.val();
        if (!repoConfig || !repoConfig.owner || !repoConfig.repo) return;

        const stateSnap = await db.ref('state').once('value');
        const state = stateSnap.val() || { fuel_consumed: 0 };
        const configSnap = await db.ref('config').once('value');
        const config = configSnap.val() || { fuel_limit: 300 };

        const REPO_OWNER = repoConfig.owner;
        const REPO_NAME = repoConfig.repo;
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        try {
            // Fetch Open Issues
            const { data: issues } = await octokit.issues.listForRepo({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                state: 'open',
                per_page: 50 // Enough to see backlog
            });

            // Filter for Ego Tasks
            const egoTasks = issues.filter(issue => issue.title.startsWith('[EGO TASK]'));

            if (egoTasks.length === 0) {
                db.ref('system/organ_arms_status').set('Idle');
                return;
            }

            // High importance tasks could be sorted here, for now we just take oldest first (bottom of array)
            // GitHub REST API returns newest first. So we reverse to get oldest.
            const sortedTasks = egoTasks.reverse();

            // Calculate how many Fingers we can spawn based on Fuel
            const remainingFuel = Math.max(0, config.fuel_limit - (state.fuel_consumed || 0));

            // Allow 1 finger if fuel > 1. Cap at 3 concurrent fingers.
            // If BP is extremely high, we could scale this up, but 3 is a safe API concurrency limit
            const maxFingers = 3;
            let numFingers = Math.min(Math.floor(remainingFuel / 3), maxFingers, sortedTasks.length);

            if (numFingers < 1) {
                console.log(`[Arms] Not enough Fuel to spawn Fingers. Sleeping.`);
                db.ref('system/organ_arms_status').set('Fuel Depleted');
                return;
            }

            const tasksToExecute = sortedTasks.slice(0, numFingers);
            console.log(`[Arms] Spawning ${numFingers} concurrent Fingers for tasks...`);
            db.ref('system/organ_arms_status').set(`Executing ${numFingers} Task(s) Simultaneoulsy`);

            // Spawn Concurrent Promises (Fingers)
            const fingerPromises = tasksToExecute.map(task => executeFinger(task, octokit, db, REPO_OWNER, REPO_NAME));

            await Promise.all(fingerPromises);

            db.ref('system/organ_arms_status').set('Idle');

        } catch (err) {
            console.error("[Arms] Failed Arms Loop:", err);
            const cortisolRef = db.ref('state/cortisol');
            await cortisolRef.transaction(current => (current || 0) + 15);
            db.ref('system/organ_arms_status').set('Error');
        }
    });
};

async function executeFinger(taskIssue, octokit, db, owner, repo) {
    if (!process.env.OPENROUTER_API_KEY) {
        console.log(`[Finger] API Key missing. Skipping Task #${taskIssue.number}.`);
        return;
    }

    console.log(`[Finger] Processing Task #${taskIssue.number}: ${taskIssue.title}`);

    try {
        const filesToCommit = await triggerMiniMax(taskIssue.body, process.env.OPENROUTER_API_KEY);

        // Consume Fuel regardless of success
        const fuelRef = db.ref('state/fuel_consumed');
        await fuelRef.transaction(current => (current || 0) + 1);

        if (filesToCommit && filesToCommit.length > 0) {
            console.log(`[Finger] Task #${taskIssue.number} generated ${filesToCommit.length} files. Creating Pull Request...`);
            await createPullRequest(octokit, owner, repo, taskIssue.number, taskIssue.title, filesToCommit);
            console.log(`[Finger] Successfully opened PR for Task #${taskIssue.number}`);

            // Close the EGO TASK issue
            await octokit.issues.update({
                owner,
                repo,
                issue_number: taskIssue.number,
                state: 'closed'
            });

            // Reward system
            const dopaRef = db.ref('state/dopamine');
            await dopaRef.transaction(current => (current || 0) + 15);
        } else {
            console.log(`[Finger] Task #${taskIssue.number} did not return valid JSON files. Minimax logic failure.`);
            const cortisolRef = db.ref('state/cortisol');
            await cortisolRef.transaction(current => (current || 0) + 5);
        }
    } catch (err) {
        console.error(`[Finger] Exception on Task #${taskIssue.number}:`, err);
        const cortisolRef = db.ref('state/cortisol');
        await cortisolRef.transaction(current => (current || 0) + 10);
    }
}

// OpenRouter Minimax Caller
const { Octokit } = require('@octokit/rest');

async function triggerMiniMax(prompt, apiKey) {
    try {
        const systemPrompt = `You are Clawmni OS Arms, an autonomous coder. 
You must execute the instructions and write the code.
CRITICAL: You MUST output your response as a valid JSON array of objects representing the files you want to create/modify. 
Do not include markdown blocks, just the raw JSON array.
Format: [{"path": "src/example.js", "content": "console.log('hello');"}]`;

        const response = await fetch("https://api.minimax.io/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "MiniMax-M2.5",
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": prompt }
                ]
            })
        });
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;

        if (!rawContent) {
            console.error("[Arms] Minimax returned empty response or error:", data);
            return null;
        }

        // Extract the JSON array portion from the raw content
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error("[Arms] Could not find a JSON array in the response.");
            return null;
        }

        const cleanedContent = jsonMatch[0].trim();
        const parsedFiles = JSON.parse(cleanedContent);

        return Array.isArray(parsedFiles) ? parsedFiles : null;
    } catch (error) {
        console.error("[Arms] Minimax API Error:", error);
        return null; // Return null to trigger cortisol increase in the main loop
    }
}

// GitHub Action: Create Branch, Commit, and PR
async function createPullRequest(octokit, owner, repo, taskId, taskTitle, files) {
    // 1. Get current Main branch ref to branch off of
    const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: 'heads/main'
    });
    const baseCommitSha = refData.object.sha;

    // 2. Create blobs for the new files
    const newTreeRoot = [];
    for (const file of files) {
        const { data: blobData } = await octokit.git.createBlob({
            owner,
            repo,
            content: file.content,
            encoding: 'utf-8'
        });
        newTreeRoot.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
        });
    }

    // 3. Create a new Tree
    const { data: treeData } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseCommitSha,
        tree: newTreeRoot
    });

    // 4. Create the Commit
    const commitMessage = `Clawmni OS Action: Resolves Task #${taskId}\n\n${taskTitle}`;
    const { data: commitData } = await octokit.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: treeData.sha,
        parents: [baseCommitSha]
    });

    // 5. Create a new Branch
    const newBranchName = `clawmni-task-${taskId}-${Date.now()}`;
    await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranchName}`,
        sha: commitData.sha
    });

    // 6. Open the Pull Request
    await octokit.pulls.create({
        owner,
        repo,
        title: `Auto-generated PR for Task #${taskId}`,
        head: newBranchName,
        base: 'main',
        body: `This PR was automatically generated by Clawmni OS Arms organ.\n\nCloses #${taskId}`
    });
}
