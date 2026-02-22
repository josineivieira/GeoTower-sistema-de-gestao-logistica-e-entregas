import React from 'react';
import Header from './Header';

const AppLayout = ({ children }) => {
  return (
    <div className="h-[100svh] w-full overflow-hidden bg-[#f7f7fb] flex flex-col">
      <Header />

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto overscroll-none">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
