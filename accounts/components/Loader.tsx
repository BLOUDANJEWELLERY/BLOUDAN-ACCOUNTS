// components/Loader.tsx
import React from 'react';

export default function Loader() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        backgroundColor: '#d4af37', // golden accent
        zIndex: 9999,
        animation: 'loadingBar 1.2s infinite',
      }}
    >
      <style jsx>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}