const { Octokit } = require('@octokit/rest');

async function triggerBrainstorming(goal, apiKey) {
    try {
        const systemPrompt = `You are Clawmni OS Id, an autonomous AI entity responsible for divergent ideation.
You are given a high-level goal. Your job is to brainstorm exactly 10 to 30 simple, one-liner technical approaches to achieve this goal within the codebase.
CRITICAL: You MUST respond ONLY with a Markdown numbered list. No introductions, no conclusions, just the numbered list.
Example:
1. Implement a new REST endpoint for user data
2. Create a React context provider for global theme
3. Refactor the authentication middleware to use JWT`;

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
                    { "role": "user", "content": `Goal: ${goal}` }
                ]
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Idea generation failed.";
    } catch (error) {
        console.error("[Id] Minimax API Error:", error);
        return "Idea generation failed due to an error.";
    }
}

module.exports = function (db) {
    console.log("[Setup] Id organ connected.");
    db.ref('system/organ_id_status').set('Idle');

    // --- THE ID (Divergent Ideation) ---
    db.ref('pulse').on('value', async (snapshot) => {
        if (!snapshot.exists()) return;

        // Fetch current state and config
        const stateSnap = await db.ref('state').once('value');
        const state = stateSnap.val() || {};

        // High Blood Pressure throttle: If BP > 1.2, skip ideation to let Arms catch up
        if (state.blood_pressure && state.blood_pressure > 1.2) {
            console.log(`[Id] Blood Pressure is high (${state.blood_pressure.toFixed(2)}). Skipping divergent ideation to avoid spamming the Memory.`);
            return;
        }

        const goalSnap = await db.ref('goals/current').once('value');
        const newGoal = goalSnap.val();
        if (!newGoal) return;

        // Fetch dynamic repo target
        const repoSnap = await db.ref('config/target_repo').once('value');
        const repoConfig = repoSnap.val();
        if (!repoConfig || !repoConfig.owner || !repoConfig.repo) {
            console.log("[Id] No target repository configured. Skipping ideation.");
            return;
        }

        const REPO_OWNER = repoConfig.owner;
        const REPO_NAME = repoConfig.repo;

        const shortGoalId = newGoal.length > 20 ? newGoal.substring(0, 20) + '...' : newGoal;
        console.log(`[Id] Activated for ${REPO_OWNER}/${REPO_NAME}. BP is nominal. Batching 10-30 approaches for: ${shortGoalId}`);
        db.ref('system/organ_id_status').set(`Batch Ideating: ${shortGoalId}`);

        // 1. Generate ideas via AI
        if (!process.env.OPENROUTER_API_KEY) {
            console.log("[Id] OPENROUTER_API_KEY missing. Skipping ideation.");
            return;
        }

        console.log(`[Id] Triggering Minimax for ideation...`);
        const ideationContent = await triggerBrainstorming(newGoal, process.env.OPENROUTER_API_KEY);

        try {
            // Push generated ideas into Firebase
            const ideasList = ideationContent.split('\n')
                .filter(l => l.trim())
                .map(l => l.replace(/^\d+\.\s*/, ''));

            for (const idea of ideasList) {
                await db.ref('ideas/pool').push(idea);
            }

            console.log(`[Id] Successfully pushed ${ideasList.length} ideas to the Firebase bloodstream.`);
            
            // Log activity
            db.ref('system/activity').push({
                type: 'ideation',
                message: `Generated ${ideasList.length} ideas for goal: ${shortGoalId}`,
                timestamp: Date.now()
            });

            // Inject slight Dopamine and consume Fuel
            const dopaRef = db.ref('state/dopamine');
            await dopaRef.transaction(current => Math.min((current || 0) + 5, 100));
            const fuelRef = db.ref('state/fuel_consumed');
            await fuelRef.transaction(current => (current || 0) + 1);

            await db.ref('system/organ_id_status').set('Idle');
            // Goal remains active, Id will trigger again if BP is low enough on next pulse
        } catch (err) {
            console.error("[Id] Failed to push ideas to Firebase:", err);
            // Increase cortisol to signal failure in the system
            const cortisolRef = db.ref('state/cortisol');
            await cortisolRef.transaction(current => (current || 0) + 10);
            await db.ref('system/organ_id_status').set('Error');
        }
    });
};
