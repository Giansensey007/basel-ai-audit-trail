import { Route, Routes } from "react-router-dom";
import { BrokenChain, Chooser, NotFound, Verify, Workspace } from "./screens";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Chooser />} />
      <Route path="/fall/:dossierId" element={<Workspace />} />
      <Route path="/v/bruch" element={<BrokenChain />} />
      <Route path="/v/:sessionId" element={<Verify />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
