import React from "react";
import Header from "../Header";

interface NavbarProps {
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
  mobileMenuOpen?: boolean;
}

export default function Navbar({ onMenuClick, sidebarCollapsed, mobileMenuOpen }: NavbarProps) {
  return (
    <Header
      onMenuClick={onMenuClick}
      sidebarCollapsed={sidebarCollapsed}
      mobileMenuOpen={mobileMenuOpen}
    />
  );
}
