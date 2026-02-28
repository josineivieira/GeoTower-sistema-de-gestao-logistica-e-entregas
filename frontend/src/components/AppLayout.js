import React from 'react';
import Header from './Header';

const AppLayout = ({ children }) => {
  return (
    <div className="h-[100svh] w-full overflow-hidden bg-[#f7f7fb] flex flex-col">
      <Header />

      {/* Scrollable content area - takes only needed height */}
      <main className="overflow-y-auto overscroll-none">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
