import React, { useState } from 'react';
import { Header } from './components/Header.js';
import { StatusOverview } from './components/StatusOverview.js';
import { Simulator } from './components/Simulator.js';
import { DeploymentGuide } from './components/DeploymentGuide.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'simulator' | 'deployment'>('monitor');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'monitor' && <StatusOverview />}
        {activeTab === 'simulator' && <Simulator />}
        {activeTab === 'deployment' && <DeploymentGuide />}
      </main>
    </div>
  );
}
