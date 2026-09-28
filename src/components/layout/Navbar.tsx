import React from "react";
import Header from "../Header";

export default function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  return <Header onMenuClick={onMenuClick} />;
}
