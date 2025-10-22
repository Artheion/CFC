import { useState } from 'react';

interface BettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export default function BettingModal({ isOpen, onClose, title, message, type }: BettingModalProps) {
  if (!isOpen) return null;

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return {
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30'
        };
      case 'error':
        return {
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30'
        };
      case 'warning':
        return {
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30'
        };
      case 'info':
      default:
        return {
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30'
        };
    }
  };

  const { icon, color, bgColor, borderColor } = getIconAndColor();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-card-dark border border-white/10 rounded-lg max-w-md w-full p-6 shadow-2xl animate-scaleIn">
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className={`${bgColor} ${color} ${borderColor} border-2 rounded-full p-4 mb-4`}>
            {icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>

          {/* Message */}
          <p className="text-white/80 mb-6">{message}</p>

          {/* OK Button */}
          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-primary-dark text-black font-bold py-3 px-6 rounded transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
