import React from "react";
import Sidebar from "../Sidebar";

interface LayoutSidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export default function LayoutSidebar({ mobile, onClose }: LayoutSidebarProps) {
  return <Sidebar mobile={mobile} onClose={onClose} />;
}
