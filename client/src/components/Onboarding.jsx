import { useState } from 'react';
import { Database, Key, Github, CheckCircle2 } from 'lucide-react';

export default function Onboarding({ onComplete }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        firebaseUrl: '',
        firebaseJsonString: '',
        githubToken: '',
        openRouterKey: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                onComplete();
            } else {
                setError(data.error || "Failed to initialize OS");
            }
        } catch (err) {
            setError("Failed to connect to backend daemon. Is it running on port 3001?");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setFormData({ ...formData, firebaseJsonString: e.target.result });
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-4">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8">

                <div className="flex items-center space-x-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded flex items-center justify-center font-bold text-xl border border-indigo-500/30">
                        C
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Clawmni OS</h1>
                        <p className="text-slate-400 text-sm">Initialization Sequence</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* STEP 1: Firebase */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center mb-4">
                            <Database className="w-5 h-5 mr-2 text-rose-400" />
                            Connect The Bloodstream (Firebase)
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Firebase acts as the real-time nervous system. It stores the active state of organs and neurochemistry (Cortisol/Dopamine) limits.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-300">Firebase Database URL</label>
                                    <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center group relative">
                                        <span className="hidden group-hover:block absolute bg-slate-800 text-slate-200 text-[10px] p-2 rounded -top-8 right-0 w-48 shadow-lg text-center">
                                            Create a Firebase project, enable Realtime Database, and copy the DB URL.
                                        </span>
                                        <Database className="w-3 h-3 mr-1" /> Get URL
                                    </a>
                                </div>
                                <input
                                    type="text"
                                    placeholder="https://your-project.firebaseio.com"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                    value={formData.firebaseUrl}
                                    onChange={e => setFormData({ ...formData, firebaseUrl: e.target.value })}
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-300">Firebase Service Account JSON</label>
                                    <a href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center group relative">
                                        <span className="hidden group-hover:block absolute bg-slate-800 text-slate-200 text-[10px] p-2 rounded -top-10 right-0 w-48 shadow-lg text-center">
                                            Project Settings {'>'} Service Accounts {'>'} Generate new private key.
                                        </span>
                                        <Key className="w-3 h-3 mr-1" /> Get Admin Key
                                    </a>
                                </div>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileChange}
                                    className="w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 transition-colors cursor-pointer"
                                />
                                {formData.firebaseJsonString && (
                                    <p className="text-emerald-400 text-xs mt-2 flex items-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Service account loaded
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end mt-8">
                            <button
                                onClick={handleNext}
                                disabled={!formData.firebaseUrl || !formData.firebaseJsonString}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next Step
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Logic & Memory */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center mb-4">
                            <Key className="w-5 h-5 mr-2 text-amber-400" />
                            API Keys & Intelligence
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Connect external intelligence explicitly targeted at MiniMax (via OpenRouter) and attach long-term memory via GitHub.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-300 flex items-center">
                                        <Key className="w-4 h-4 mr-1 text-slate-500" />
                                        OpenRouter API Key (MiniMax Access)
                                    </label>
                                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 flex items-center group relative">
                                        <span className="hidden group-hover:block absolute bg-slate-800 text-slate-200 text-[10px] p-2 rounded -top-8 right-0 w-48 shadow-lg text-center">
                                            Create an OpenRouter account, add credits, and create a key.
                                        </span>
                                        Get Key
                                    </a>
                                </div>
                                <input
                                    type="password"
                                    placeholder="sk-or-v1-..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                    value={formData.openRouterKey}
                                    onChange={e => setFormData({ ...formData, openRouterKey: e.target.value })}
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-300 flex items-center">
                                        <Github className="w-4 h-4 mr-1 text-slate-500" />
                                        GitHub Personal Access Token
                                    </label>
                                    <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 flex items-center group relative">
                                        <span className="hidden group-hover:block absolute bg-slate-800 text-slate-200 text-[10px] p-2 rounded -top-10 right-0 w-48 shadow-lg text-center z-10">
                                            Create a Fine-Grained PAT with Read/Write access to Code, Issues, and PRs.
                                        </span>
                                        Get Token
                                    </a>
                                </div>
                                <input
                                    type="password"
                                    placeholder="github_pat_..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                    value={formData.githubToken}
                                    onChange={e => setFormData({ ...formData, githubToken: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-between mt-8">
                            <button
                                onClick={handleBack}
                                className="text-slate-400 hover:text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!formData.openRouterKey || !formData.githubToken || isSubmitting}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                                {isSubmitting ? 'Igniting Heartbeat...' : 'Initialize OS'}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
