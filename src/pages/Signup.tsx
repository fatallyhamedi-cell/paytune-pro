import React from "react";
import { Navigate } from "react-router-dom";

export default function Signup() {
  return <Navigate to="/auth?tab=signup" replace />;
}
