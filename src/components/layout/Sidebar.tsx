import React from "react";
import Sidebar from "../Sidebar";

interface LayoutSidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export default function LayoutSidebar({
  mobile,
  collapsed,
  onClose,
  onToggleCollapse,
}: LayoutSidebarProps) {
  return (
    <Sidebar
      mobile={mobile}
      collapsed={collapsed}
      onClose={onClose}
      onToggleCollapse={onToggleCollapse}
    />
  );
}
