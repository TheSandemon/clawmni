import { useState, useEffect } from 'react';
import { Activity, BrainCircuit, ShieldAlert, CheckCircle2, Terminal, Github, Trash2, RefreshCw, GitPullRequest, AlertCircle } from 'lucide-react';

export default function Dashboard() {
    const [db, setDb] = useState(null);
    const [ideas, setIdeas] = useState([]);
    const [githubData, setGithubData] = useState({ issues: [], prs: [], repo: null });
    const [goalHistory, setGoalHistory] = useState([]);
    const [activityLog, setActivityLog] = useState([]);
    const [state, setState] = useState({
        system: { heart_status: 'Offline', status_message: 'Connecting to bloodstream...', last_pulse: 0 },
        organs: { id: 'Offline', ego: 'Offline', arms: 'Offline', nose: 'Offline' },
        organStats: { id: {}, ego: {}, arms: {}, nose: {} },
        chemistry: { cortisol: 0, dopamine: 0, blood_pressure: 1.0, fuel_consumed: 0, open_issues: 0 },
        goals: { current: '' },
        config: { target_repo: { owner: '', repo: '' }, base_pulse_rate: 60000, fuel_limit: 300, max_tasks: 1 }
    });

    const [newGoalInput, setNewGoalInput] = useState('');
    const [repoInput, setRepoInput] = useState({ owner: '', repo: '' });
    const [configInput, setConfigInput] = useState({ base_pulse_rate: '', fuel_limit: '', max_tasks: '' });
    const [ideas, setIdeas] = useState([]);
    const [expandedOrgans, setExpandedOrgans] = useState({});
    const [settings, setSettings] = useState({ theme: 'dark' });

    // Sync config inputs when state loads
    useEffect(() => {
        if (state.config.base_pulse_rate && !configInput.base_pulse_rate) {
            setConfigInput({
                base_pulse_rate: Math.round(state.config.base_pulse_rate / 60000), // Convert ms to minutes for frontend display
                fuel_limit: state.config.fuel_limit,
                max_tasks: state.config.max_tasks || 1
            });
        }
    }, [state.config]);

    useEffect(() => {
        // We need to fetch the firebase config from the server to initialize the client DB connection cleanly.
        // For demo/simplicity, we can just hit our local Express API or initialize from env if available.
        // Because Firebase JS SDK uses standard config (unlike Admin SDK), we would normally pass the web config.
        // However, since the user already gave the backend their service account and URL, 
        // the cleanest way to do this without writing a full Firebase Web Config initializer
        // is to poll the express server, or we can just initialize Firebase client with the Database URL.

        // Attempting direct client SDK connection using just URL (works if rules are open temporarily, 
        // or we proxy it through the Express Server. For real-time, proxying through Express via Server-Sent-Events is safer.
        // Below is a polling fallback for the demo if Firebase client config isn't fully set up for the frontend yet.

        let isMounted = true;

        // Instead of raw firebase client setup right now, we will poll the backend for state proxy
        // In a production app you'd strictly use Firebase Web SDK here configured via an endpoint.

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const pollBackend = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/state`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    setState(data);
                }
                // Also fetch ideas
                const ideasRes = await fetch(`${API_URL}/api/ideas`);
                if (ideasRes.ok && isMounted) {
                    const ideasData = await ideasRes.json();
                    setIdeas(ideasData.ideas || []);
                }
                // Also fetch GitHub data
                const ghRes = await fetch(`${API_URL}/api/github/issues`);
                if (ghRes.ok && isMounted) {
                    const ghData = await ghRes.json();
                    setGithubData(ghData);
                }
                // Also fetch goal history
                const historyRes = await fetch(`${API_URL}/api/goals/history`);
                if (historyRes.ok && isMounted) {
                    const historyData = await historyRes.json();
                    setGoalHistory(historyData.history || []);
                }
                // Also fetch activity log
                const activityRes = await fetch(`${API_URL}/api/activity`);
                if (activityRes.ok && isMounted) {
                    const activityData = await activityRes.json();
                    setActivityLog(activityData.activity || []);
                }
                // Also fetch settings
                const settingsRes = await fetch(`${API_URL}/api/settings`);
                if (settingsRes.ok && isMounted) {
                    const settingsData = await settingsRes.json();
                    setSettings(settingsData);
                }
            } catch (err) {
                console.error("Dashboard poll failed", err);
            }
        }, 2000);

        return () => {
            isMounted = false;
            clearInterval(pollBackend);
        };
    }, []);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const handleSetGoal = async () => {
        if (!newGoalInput.trim()) return;

        try {
            await fetch(`${API_URL}/api/goal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal: newGoalInput })
            });
            setNewGoalInput('');
        } catch (err) {
            console.error(err);
        }
    };

    const handleSetRepo = async () => {
        if (!repoInput.owner || !repoInput.repo) return;
        try {
            await fetch(`${API_URL}/api/config/repo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(repoInput)
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleSetConfig = async () => {
        try {
            const minutes = parseFloat(configInput.base_pulse_rate);
            const ms = Math.round(minutes * 60000); // Convert minutes back to ms for backend

            await fetch(`${API_URL}/api/config/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_pulse_rate: ms,
                    fuel_limit: parseInt(configInput.fuel_limit, 10),
                    max_tasks: parseInt(configInput.max_tasks, 10)
                })
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleTriggerPulse = async () => {
        try {
            await fetch(`${API_URL}/api/pulse/trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleStopHeart = async () => {
        try {
            await fetch(`${API_URL}/api/heart/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartHeart = async () => {
        try {
            await fetch(`${API_URL}/api/heart/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleResetState = async () => {
        if (!confirm('Reset system state (fuel, cortisol, dopamine)?')) return;
        try {
            await fetch(`${API_URL}/api/state/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleClearIdeas = async () => {
        try {
            await fetch(`${API_URL}/api/ideas`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            setIdeas([]);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchIdeas = async () => {
        try {
            const res = await fetch(`${API_URL}/api/ideas`);
            const data = await res.json();
            setIdeas(data.ideas || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchGithubData = async () => {
        try {
            const res = await fetch(`${API_URL}/api/github/issues`);
            if (res.ok) {
                const data = await res.json();
                setGithubData(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchGoalHistory = async () => {
        try {
            const res = await fetch(`${API_URL}/api/goals/history`);
            const data = await res.json();
            setGoalHistory(data.history || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchActivity = async () => {
        try {
            const res = await fetch(`${API_URL}/api/activity`);
            const data = await res.json();
            setActivityLog(data.activity || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleClearActivity = async () => {
        try {
            await fetch(`${API_URL}/api/activity`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            setActivityLog([]);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleOrganExpand = (organ) => {
        setExpandedOrgans(prev => ({ ...prev, [organ]: !prev[organ] }));
    };

    const handleToggleTheme = async () => {
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        try {
            await fetch(`${API_URL}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme })
            });
            setSettings(prev => ({ ...prev, theme: newTheme }));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center">
                        <Terminal className="w-8 h-8 mr-3 text-indigo-400" /> Clawmni OS
                    </h1>
                    <p className="text-slate-400 mt-1">Real-time Autonomous Supervisor</p>
                </div>
                <div className="flex items-center space-x-4 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
                    <button
                        onClick={handleToggleTheme}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                        title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {settings.theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${state.system.heart_running ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-sm font-medium text-slate-300">Heart: {state.system.heart_running ? 'Running' : 'Stopped'}</span>
                    </div>
                    <div className="text-xs text-slate-500 border-l border-slate-700 pl-4 flex flex-col">
                        <span>Base Pulse: {state.config.base_pulse_rate ? Math.round(state.config.base_pulse_rate / 60000) : 1} min</span>
                        <span className="text-indigo-400">BP: {parseFloat(state.chemistry.blood_pressure).toFixed(2)}x</span>
                    </div>
                    <div className="flex space-x-1">
                        {state.system.heart_running ? (
                            <button
                                onClick={handleStopHeart}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded transition-colors"
                                title="Stop heartbeat"
                            >
                                Stop
                            </button>
                        ) : (
                            <button
                                onClick={handleStartHeart}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors"
                                title="Start heartbeat"
                            >
                                Start
                            </button>
                        )}
                        <button
                            onClick={handleTriggerPulse}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
                            title="Trigger manual pulse now"
                        >
                            Pulse
                        </button>
                    </div>
                </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Neurochemistry & Globals */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                            <Activity className="w-4 h-4 mr-2" />
                            Neurochemistry
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-violet-400 font-medium flex items-center"><Activity className="w-4 h-4 mr-1" /> Blood Pressure (Throttle)</span>
                                    <span className="text-slate-300">{parseFloat(state.chemistry.blood_pressure).toFixed(2)} / 3.0</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-violet-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((state.chemistry.blood_pressure / 3.0) * 100, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Balances {state.chemistry.open_issues} Open Issues vs remaining API Fuel.</p>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-amber-400 font-medium flex items-center"><Terminal className="w-4 h-4 mr-1" /> API Fuel (Prompts / 5 hours)</span>
                                    <span className="text-slate-300">{state.config.fuel_limit - state.chemistry.fuel_consumed} / {state.config.fuel_limit}</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${((state.config.fuel_limit - state.chemistry.fuel_consumed) / state.config.fuel_limit) * 100}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-rose-400 font-medium flex items-center"><ShieldAlert className="w-4 h-4 mr-1" /> Cortisol (Stress/Error)</span>
                                    <span className="text-slate-300">{state.chemistry.cortisol}/100</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-rose-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(state.chemistry.cortisol, 100)}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-emerald-400 font-medium flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Dopamine (Success)</span>
                                    <span className="text-slate-300">{state.chemistry.dopamine}/100</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(state.chemistry.dopamine, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                            <Github className="w-4 h-4 mr-2" /> System Configuration
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Target Repository</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Owner"
                                        value={repoInput.owner}
                                        onChange={e => setRepoInput({ ...repoInput, owner: e.target.value })}
                                        className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Repo"
                                        value={repoInput.repo}
                                        onChange={e => setRepoInput({ ...repoInput, repo: e.target.value })}
                                        className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <button onClick={handleSetRepo} className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-xs transition-colors border border-slate-700">
                                    Update Target
                                </button>
                                {state.config?.target_repo?.owner && (
                                    <div className="mt-2 text-xs font-semibold text-indigo-400">Current: {state.config.target_repo.owner}/{state.config.target_repo.repo}</div>
                                )}
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <label className="text-xs text-slate-500 mb-1 block">Heart & Fuel Throttle</label>
                                <div className="flex space-x-2">
                                    <div className="w-1/3">
                                        <label className="text-[10px] text-slate-600">Base Pulse (Minutes)</label>
                                        <input
                                            type="number"
                                            value={configInput.base_pulse_rate}
                                            onChange={e => setConfigInput({ ...configInput, base_pulse_rate: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="w-1/3">
                                        <label className="text-[10px] text-slate-600">API Fuel Limit</label>
                                        <input
                                            type="number"
                                            value={configInput.fuel_limit}
                                            onChange={e => setConfigInput({ ...configInput, fuel_limit: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="w-1/3">
                                        <label className="text-[10px] text-slate-600">Max Tasks Allowed</label>
                                        <input
                                            type="number"
                                            value={configInput.max_tasks}
                                            onChange={e => setConfigInput({ ...configInput, max_tasks: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                                <button onClick={handleSetConfig} className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-xs transition-colors border border-slate-700">
                                    Apply Settings
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex-grow">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Command Input (Id)</h2>
                        <p className="text-xs text-slate-500 mb-4">Inject a high-level abstract goal into the bloodstream.</p>
                        <textarea
                            value={newGoalInput}
                            onChange={e => setNewGoalInput(e.target.value)}
                            placeholder="E.g., Design a new landing page for the gallery with a dark theme..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none h-32"
                        />
                        <button
                            onClick={handleSetGoal}
                            className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Inject Goal
                        </button>

                        {state.goals.current && (
                            <div className="mt-4 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg">
                                <p className="text-xs font-semibold text-indigo-400 mb-1">Active Goal:</p>
                                <p className="text-sm text-slate-300 break-words">{state.goals.current}</p>
                            </div>
                        )}
                    </div>

                    {/* Goal History */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Goal History ({goalHistory.length})</h2>
                            <button
                                onClick={fetchGoalHistory}
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                                title="Refresh history"
                            >
                                <RefreshCw className="w-3 h-3" />
                            </button>
                        </div>
                        {goalHistory.length === 0 ? (
                            <p className="text-xs text-slate-500">No goal history yet</p>
                        ) : (
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {goalHistory.slice(0, 10).map((goal, idx) => (
                                    <li key={goal.id || idx} className="text-xs text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                                        <span className="text-slate-500">
                                            {new Date(goal.timestamp).toLocaleString()}
                                        </span>
                                        <p className="text-slate-300 mt-1">{goal.text}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Ideas Pool */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                                <BrainCircuit className="w-4 h-4 mr-2" /> Ideas Pool ({ideas.length})
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={fetchIdeas}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                                    title="Refresh ideas"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleClearIdeas}
                                    className="p-1.5 bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-400 rounded transition-colors"
                                    title="Clear ideas pool"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        {ideas.length === 0 ? (
                            <p className="text-xs text-slate-500">No ideas in pool. Set a goal to start ideation.</p>
                        ) : (
                            <ul className="space-y-2 max-h-48 overflow-y-auto">
                                {ideas.map((idea, idx) => (
                                    <li key={idea.id || idx} className="text-xs text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                                        {idea.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* System Reset */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-400">Reset System State</p>
                                <p className="text-[10px] text-slate-500">Clear fuel, cortisol, dopamine</p>
                            </div>
                            <button
                                onClick={handleResetState}
                                className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-900 text-rose-400 text-xs font-medium rounded transition-colors border border-rose-800"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* GitHub Issues & PRs */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                                <Github className="w-4 h-4 mr-2 text-slate-400" />
                                <span className="text-xs text-slate-400">GitHub ({githubData.repo || 'No repo'})</span>
                            </div>
                            <button
                                onClick={fetchGithubData}
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                                title="Refresh GitHub data"
                            >
                                <RefreshCw className="w-3 h-3" />
                            </button>
                        </div>
                        
                        {/* Issues */}
                        <div className="mb-3">
                            <div className="flex items-center text-xs text-slate-500 mb-1">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Open Issues ({githubData.issues.length})
                            </div>
                            {githubData.issues.length === 0 ? (
                                <p className="text-[10px] text-slate-600">No open issues</p>
                            ) : (
                                <ul className="space-y-1 max-h-24 overflow-y-auto">
                                    {githubData.issues.slice(0, 5).map(issue => (
                                        <li key={issue.number} className="text-[10px] text-slate-400 truncate">
                                            <span className="text-indigo-400">#{issue.number}</span> {issue.title}
                                        </li>
                                    ))}
                                    {githubData.issues.length > 5 && (
                                        <li className="text-[10px] text-slate-500">+{githubData.issues.length - 5} more...</li>
                                    )}
                                </ul>
                            )}
                        </div>

                        {/* PRs */}
                        <div>
                            <div className="flex items-center text-xs text-slate-500 mb-1">
                                <GitPullRequest className="w-3 h-3 mr-1" />
                                Open PRs ({githubData.prs.length})
                            </div>
                            {githubData.prs.length === 0 ? (
                                <p className="text-[10px] text-slate-600">No open PRs</p>
                            ) : (
                                <ul className="space-y-1 max-h-24 overflow-y-auto">
                                    {githubData.prs.slice(0, 5).map(pr => (
                                        <li key={pr.number} className="text-[10px] text-slate-400 truncate">
                                            <span className="text-emerald-400">PR #{pr.number}</span> {pr.title}
                                        </li>
                                    ))}
                                    {githubData.prs.length > 5 && (
                                        <li className="text-[10px] text-slate-500">+{githubData.prs.length - 5} more...</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Activity Log</h2>
                            <div className="flex space-x-1">
                                <button
                                    onClick={fetchActivity}
                                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                                    title="Refresh activity"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleClearActivity}
                                    className="p-1 bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-400 rounded transition-colors"
                                    title="Clear activity log"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        {activityLog.length === 0 ? (
                            <p className="text-xs text-slate-500">No activity yet</p>
                        ) : (
                            <ul className="space-y-1 max-h-40 overflow-y-auto">
                                {activityLog.slice(0, 20).map((entry, idx) => (
                                    <li key={entry.id || idx} className="text-[10px] text-slate-400">
                                        <span className="text-slate-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                        <span className={`ml-2 px-1 rounded ${
                                            entry.type === 'pr' ? 'bg-emerald-900/50 text-emerald-400' :
                                            entry.type === 'task' ? 'bg-blue-900/50 text-blue-400' :
                                            entry.type === 'execution' ? 'bg-amber-900/50 text-amber-400' :
                                            entry.type === 'ideation' ? 'bg-indigo-900/50 text-indigo-400' :
                                            'bg-slate-800 text-slate-400'
                                        }`}>
                                            {entry.type}
                                        </span>
                                        <span className="ml-1 text-slate-300">{entry.message}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Right Column: Organs */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center mt-2">
                        <BrainCircuit className="w-4 h-4 mr-2" />
                        Organ Status Monitor
                    </h2>
                    <p className="text-sm text-slate-500 mb-2">Systems awaken based on chemical pulses and specific Firebase triggers.</p>

                    {/* THE ID */}
                    <div 
                        className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 transition-colors"
                        onClick={() => toggleOrganExpand('id')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-200">The Id</h3>
                                <p className="text-sm text-slate-400">Divergent Ideation & Abstraction</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${state.organs.id === 'Idle' || state.organs.id === 'Offline'
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : state.organs.id.includes('Error')
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                        : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 animate-pulse'
                                    }`}>
                                    {state.organs.id}
                                </span>
                            </div>
                        </div>
                        {expandedOrgans.id && (
                            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>Ideations: {state.organStats?.id?.total_ideations || 0}</div>
                                    <div>Ideas Generated: {state.organStats?.id?.ideas_generated || 0}</div>
                                    <div className="col-span-2">Last Active: {state.organStats?.id?.last_active ? new Date(state.organStats.id.last_active).toLocaleString() : 'Never'}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* THE EGO */}
                    <div 
                        className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-blue-500/50 transition-colors"
                        onClick={() => toggleOrganExpand('ego')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-200">The Ego</h3>
                                <p className="text-sm text-slate-400">Executive Planning & Triaging</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${state.organs.ego === 'Idle' || state.organs.ego === 'Offline'
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : state.organs.ego.includes('Error')
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                        : 'bg-blue-500/20 border-blue-500/50 text-blue-300 animate-pulse'
                                    }`}>
                                    {state.organs.ego}
                                </span>
                            </div>
                        </div>
                        {expandedOrgans.ego && (
                            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>Tasks Created: {state.organStats?.ego?.tasks_created || 0}</div>
                                    <div className="col-span-2">Last Active: {state.organStats?.ego?.last_active ? new Date(state.organStats.ego.last_active).toLocaleString() : 'Never'}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* THE ARMS */}
                    <div 
                        className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-emerald-500/50 transition-colors"
                        onClick={() => toggleOrganExpand('arms')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-200">The Arms <span className="text-xs text-slate-500 font-normal ml-2">(Powered by MiniMax m2.5)</span></h3>
                                <p className="text-sm text-slate-400">Task Decomposition & Coding</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${state.organs.arms === 'Idle' || state.organs.arms === 'Offline'
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : state.organs.arms.includes('Error')
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                        : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 animate-pulse'
                                    }`}>
                                    {state.organs.arms}
                                </span>
                            </div>
                        </div>
                        {expandedOrgans.arms && (
                            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>Executions: {state.organStats?.arms?.executions || 0}</div>
                                    <div>PRs Opened: {state.organStats?.arms?.prs_opened || 0}</div>
                                    <div className="col-span-2">Last Active: {state.organStats?.arms?.last_active ? new Date(state.organStats.arms.last_active).toLocaleString() : 'Never'}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* THE NOSE */}
                    <div 
                        className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-amber-500/50 transition-colors"
                        onClick={() => toggleOrganExpand('nose')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-200">The Nose</h3>
                                <p className="text-sm text-slate-400">Codebase Auditor & Reviewer</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${state.organs.nose === 'Idle' || state.organs.nose === 'Offline'
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : state.organs.nose.includes('Error')
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                        : 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                                    }`}>
                                    {state.organs.nose}
                                </span>
                            </div>
                        </div>
                        {expandedOrgans.nose && (
                            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>Audits Run: {state.organStats?.nose?.audits_run || 0}</div>
                                    <div className="col-span-2">Last Active: {state.organStats?.nose?.last_active ? new Date(state.organStats.nose.last_active).toLocaleString() : 'Never'}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-400">
                        <span className="text-indigo-400 font-bold">System Log &gt;</span> {state.system.status_message} <br />
                        Last Pulse: {new Date(state.system.last_pulse).toLocaleTimeString()}
                    </div>

                </div>
            </div>
        </div>
    );
}
