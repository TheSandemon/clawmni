const { Octokit } = require('@octokit/rest');

let heartbeatTimer = null;

function startHeartbeat(db) {
    if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
    }

    // Load Organs (They will read target repo dynamically from Firebase and create their own Octokit instances)
    require('./organs/id')(db);
    require('./organs/ego')(db);
    require('./organs/arms')(db);
    require('./organs/nose')(db);

    console.log("[Heart] Clawmni OS Heart is booting up...");

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Ensure baseline config exists
    db.ref('config').update({
        base_pulse_rate: 60000,
        fuel_limit: 300
    });

    // Start recursive heartbeat
    beat(db, octokit);
}

async function beat(db, octokit) {
    try {
        await triggerPulse(db, octokit);
    } catch (err) {
        console.error("[Heart] Heartbeat error:", err);
    }

    // Read configured base pulse rate
    const configSnap = await db.ref('config').once('value');
    const config = configSnap.val() || { base_pulse_rate: 60000 };
    const stateSnap = await db.ref('state').once('value');
    const state = stateSnap.val() || { blood_pressure: 1.0 };

    // Calculate next interval based on Blood Pressure
    // If BP is high (>1.0), the pulse slows down (e.g. 1.5 * 60s) to let Arms catch up without burning prompt fuel
    // If BP is low (<1.0), the pulse speeds up (e.g. 0.5 * 60s) to accelerate Ideation
    // We cap it between 0.25x and 3x to prevent runaway loops or stalling
    let bpMultiplier = state.blood_pressure || 1.0;
    bpMultiplier = Math.max(0.25, Math.min(bpMultiplier, 3.0));

    const nextPulseDuration = Math.round((config.base_pulse_rate || 60000) * bpMultiplier);

    console.log(`[Heart] Next pulse in ${nextPulseDuration}ms (BP Multiplier: ${bpMultiplier.toFixed(2)}x)`);
    heartbeatTimer = setTimeout(() => beat(db, octokit), nextPulseDuration);
}

async function triggerPulse(db, octokit) {
    const stateSnap = await db.ref('state').once('value');
    const state = stateSnap.val() || { cortisol: 0, dopamine: 0, fuel_consumed: 0 };

    const configSnap = await db.ref('config').once('value');
    const config = configSnap.val() || { target_repo: { owner: '', repo: '' }, fuel_limit: 300 };

    let openIssuesCount = 0;

    // Fetch GitHub Issues count for BP Calculation if repo is configured
    if (config.target_repo && config.target_repo.owner && config.target_repo.repo) {
        try {
            const { data: issues } = await octokit.issues.listForRepo({
                owner: config.target_repo.owner,
                repo: config.target_repo.repo,
                state: 'open',
                per_page: 100 // Approximation max for BP
            });
            openIssuesCount = issues.length;
        } catch (err) {
            console.error("[Heart] Failed to fetch issues for BP calculation", err.message);
        }
    }

    // --- BLOOD PRESSURE CALCULATION ---
    // Formula: (Open Backlog / 10) * (Fuel Limit / Remaining Fuel)
    // If Backlog gets large (e.g. 20 issues), and Remaining Fuel gets small, BP skyrockets
    const remainingFuel = Math.max(1, (config.fuel_limit || 300) - (state.fuel_consumed || 0));
    let bloodPressure = (openIssuesCount / 10) * ((config.fuel_limit || 300) / remainingFuel);

    // Prevent divide by zero / empty states
    if (bloodPressure < 0.1) bloodPressure = 0.5; // Minimum resting BP

    await db.ref('state/blood_pressure').set(bloodPressure);
    await db.ref('state/open_issues').set(openIssuesCount);

    // Write status for Dashboard
    await db.ref('system/heart_status').set(`Beating (BP: ${bloodPressure.toFixed(2)})`);
    await db.ref('system/last_pulse').set(Date.now());

    // Push cycle forward based on chemical state & BP
    if (state.cortisol > 80 || bloodPressure > 2.0) {
        console.log(`[Pulse] Stress/BP High (Cortisol: ${state.cortisol}, BP: ${bloodPressure.toFixed(2)}). Forcing execution, halting Ideation.`);
        await db.ref('system/status_message').set('High BP/Stress. Execution focus.');

        // Only trigger Arms/Ego to process backlog, don't trigger Id to generate more
        db.ref('pulse_execute').set(Date.now());
    } else {
        console.log(`[Pulse] Pulse normal. Triggering full OS cycle.`);
        await db.ref('system/status_message').set('Pulse Normal.');
        db.ref('pulse').set(Date.now());
        db.ref('pulse_execute').set(Date.now()); // Ensure executor runs
    }
}

module.exports = { startHeartbeat };
