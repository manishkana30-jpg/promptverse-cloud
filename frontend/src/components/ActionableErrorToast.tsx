import React from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

export interface ActionableError {
  code: string;
  message: string;
  remedy?: string;
  action_link?: string;
}

interface Props {
  error: ActionableError | null;
  onClose: () => void;
}

export const ActionableErrorToast: React.FC<Props> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[100] animate-fadeIn">
      <div className="bg-gray-900 border border-red-500/50 rounded-xl shadow-2xl p-4 max-w-sm relative flex flex-col gap-3">
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1 pr-4">
            <h4 className="text-red-400 font-bold text-sm mb-1">{error.code}</h4>
            <p className="text-white text-sm font-medium mb-1">{error.message}</p>
            {error.remedy && (
              <p className="text-gray-400 text-xs">{error.remedy}</p>
            )}
          </div>
        </div>

        {error.action_link && (
          <a 
            href={error.action_link}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold py-2 rounded-lg text-sm transition-all"
          >
            Fix Issue <ArrowRight className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};
