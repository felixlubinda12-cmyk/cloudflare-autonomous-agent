import React from 'react';
import { ShieldCheck, Cpu, Terminal } from 'lucide-react';

interface HeaderProps {
  activeTab: 'monitor' | 'simulator' | 'deployment';
  onTabChange: (tab: 'monitor' | 'simulator' | 'deployment') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-lg border border-orange-500/30">
              CF
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-base tracking-tight">
                  Cloudflare Autonomous Agent
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 font-medium">
                  Phase 1
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cloudflare Workers   D1   KV   R2   Gemini Flash   Telegram
              </p>
            </div>
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="tab-monitor"
              onClick={() => onTabChange('monitor')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'monitor'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Cpu className="w-4 h-4" />
                <span>Architecture & Status</span>
              </span>
            </button>
            <button
              id="tab-simulator"
              onClick={() => onTabChange('simulator')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'simulator'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Terminal className="w-4 h-4" />
                <span>Test Console</span>
              </span>
            </button>
            <button
              id="tab-deployment"
              onClick={() => onTabChange('deployment')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'deployment'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Setup & Deploy</span>
              </span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
