import React, { createContext, useContext, useState } from 'react';
import SideMenu from '../components/SideMenu';

const MenuContext = createContext<{ open: () => void }>({ open: () => {} });

/** Wraps the owner tabs so any screen header can open the side menu. */
export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <MenuContext.Provider value={{ open: () => setVisible(true) }}>
      {children}
      <SideMenu visible={visible} onClose={() => setVisible(false)} />
    </MenuContext.Provider>
  );
}

export const useMenu = () => useContext(MenuContext);
