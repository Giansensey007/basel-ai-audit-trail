import { Route, Routes } from "react-router-dom";
import { BrokenChain, Chooser, NotFound, Resource, Verify, Workspace } from "./screens";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Chooser />} />
      <Route path="/fall/:dossierId" element={<Workspace />} />
      <Route path="/v/bruch" element={<BrokenChain />} />
      <Route path="/v/:sessionId" element={<Verify />} />
      <Route path="/unterlagen/:fileId" element={<Resource />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
