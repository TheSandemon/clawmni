import { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/status');
      const data = await res.json();
      setIsSetup(data.initialized);
    } catch (err) {
      console.error("Backend not running yet", err);
    } finally {
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400">Waking Clawmni OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      {!isSetup ? (
        <Onboarding onComplete={() => setIsSetup(true)} />
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
