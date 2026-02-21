const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load from root
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const { startHeartbeat, stopHeartbeat, restartHeartbeat } = require('./heart');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase if service account exists
let db = null;
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

async function initializeFirebase() {
    if (fs.existsSync(serviceAccountPath)) {
        try {
            if (admin.apps.length > 0) {
                await Promise.all(admin.apps.map(app => app.delete()));
            }
            // Clear require cache to ensure fresh JSON read
            delete require.cache[require.resolve(serviceAccountPath)];
            const serviceAccount = require(serviceAccountPath);

            if (!process.env.FIREBASE_DATABASE_URL) {
                console.warn("[Server] FIREBASE_DATABASE_URL is missing. DB cannot initialize yet.");
                return false;
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL
            });

            db = admin.database();
            console.log("[Server] Firebase connected successfully.");

            // Attempt to start heartbeat if all config is present
            if (process.env.GITHUB_TOKEN && process.env.OPENROUTER_API_KEY) {
                startHeartbeat(db);
            } else {
                console.warn("[Server] Heartbeat waiting on GITHUB_TOKEN or OPENROUTER_API_KEY.");
            }
            return true;
        } catch (err) {
            console.error("[Server] Firebase Init Error:", err);
            return false;
        }
    }
    return false;
}

// Initial attempt
initializeFirebase();

// API ROUTES FOR FRONTEND

// 1. Status Check (Is OS initialized?)
app.get('/api/status', (req, res) => {
    const hasFirebase = fs.existsSync(serviceAccountPath);
    const hasGitHub = !!process.env.GITHUB_TOKEN;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasDbUrl = !!process.env.FIREBASE_DATABASE_URL;

    res.json({
        initialized: hasFirebase && hasGitHub && hasOpenRouter && hasDbUrl,
        config: {
            firebaseJson: hasFirebase,
            firebaseUrl: hasDbUrl,
            githubToken: hasGitHub,
            openRouterKey: hasOpenRouter
        }
    });
});

// 2. Setup Configuration (Receive keys from Onboarding)
app.post('/api/setup', (req, res) => {
    const { githubToken, openRouterKey, firebaseUrl, firebaseJsonString } = req.body;

    try {
        // Write env vars
        let envContent = '';
        if (fs.existsSync(path.join(__dirname, '../.env'))) {
            envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
        }

        const updateEnv = (key, val) => {
            if (!val) return;
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${val}`);
            } else {
                envContent += `\n${key}=${val}`;
            }
        };

        updateEnv('GITHUB_TOKEN', githubToken);
        updateEnv('OPENROUTER_API_KEY', openRouterKey);
        updateEnv('FIREBASE_DATABASE_URL', firebaseUrl);

        fs.writeFileSync(path.join(__dirname, '../.env'), envContent.trim());
        process.env.GITHUB_TOKEN = githubToken || process.env.GITHUB_TOKEN;
        process.env.OPENROUTER_API_KEY = openRouterKey || process.env.OPENROUTER_API_KEY;
        process.env.FIREBASE_DATABASE_URL = firebaseUrl || process.env.FIREBASE_DATABASE_URL;

        // Write service account JSON
        if (firebaseJsonString) {
            fs.writeFileSync(serviceAccountPath, firebaseJsonString);
        }

        // Attempt initialization
        const success = initializeFirebase();
        res.json({ success, message: "Configuration saved." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Read System State (For Dashboard)
app.get('/api/state', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        const sysSnap = await db.ref('system').once('value');
        const stateSnap = await db.ref('state').once('value');
        const goalsSnap = await db.ref('goals').once('value');
        const configSnap = await db.ref('config').once('value');

        const system = sysSnap.val() || { heart_status: 'Offline', status_message: 'Waiting...', last_pulse: 0, organ_id_status: 'Offline', organ_ego_status: 'Offline', organ_arms_status: 'Offline', organ_nose_status: 'Offline' };
        const stateVal = stateSnap.val() || { cortisol: 0, dopamine: 0, blood_pressure: 1.0, fuel_consumed: 0, open_issues: 0 };
        const goals = goalsSnap.val() || { current: '' };
        const config = configSnap.val() || { target_repo: { owner: '', repo: '' }, base_pulse_rate: 60000, fuel_limit: 300, max_tasks: 1 };

        res.json({
            system: {
                heart_status: system.heart_status,
                heart_running: system.heart_running ?? false,
                status_message: system.status_message,
                last_pulse: system.last_pulse
            },
            organs: {
                id: system.organ_id_status || 'Offline',
                ego: system.organ_ego_status || 'Offline',
                arms: system.organ_arms_status || 'Offline',
                nose: system.organ_nose_status || 'Offline'
            },
            chemistry: {
                cortisol: stateVal.cortisol || 0,
                dopamine: stateVal.dopamine || 0,
                blood_pressure: stateVal.blood_pressure || 1.0,
                fuel_consumed: stateVal.fuel_consumed || 0,
                open_issues: stateVal.open_issues || 0
            },
            goals: {
                current: goals.current || ''
            },
            config: {
                target_repo: config.target_repo || { owner: '', repo: '' },
                base_pulse_rate: config.base_pulse_rate || 60000,
                fuel_limit: config.fuel_limit || 300,
                max_tasks: config.max_tasks || 1
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Set Abstract Goal
app.post('/api/goal', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        const { goal } = req.body;
        if (goal) {
            await db.ref('goals/current').set(goal);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4b. Trigger Manual Pulse (for testing)
app.post('/api/pulse/trigger', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        await db.ref('pulse').set(Date.now());
        await db.ref('pulse_execute').set(Date.now());
        res.json({ success: true, message: "Manual pulse triggered" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4c. Stop Heartbeat
app.post('/api/heart/stop', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        stopHeartbeat(db);
        res.json({ success: true, message: "Heartbeat stopped" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4d. Start Heartbeat
app.post('/api/heart/start', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        restartHeartbeat(db);
        res.json({ success: true, message: "Heartbeat started" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Config Target Repo
app.post('/api/config/repo', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        const { owner, repo } = req.body;
        if (owner && repo) {
            await db.ref('config/target_repo').set({ owner, repo });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Config System Settings
app.post('/api/config/settings', async (req, res) => {
    if (!db) return res.status(503).json({ error: "Firebase not initialized" });
    try {
        const { base_pulse_rate, fuel_limit, max_tasks } = req.body;
        const updates = {};
        if (base_pulse_rate) updates.base_pulse_rate = parseInt(base_pulse_rate);
        if (fuel_limit) updates.fuel_limit = parseInt(fuel_limit);
        if (max_tasks !== undefined) updates.max_tasks = parseInt(max_tasks);

        if (Object.keys(updates).length > 0) {
            await db.ref('config').update(updates);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Server] Clawmni OS Backend running on http://localhost:${PORT}`);
});
