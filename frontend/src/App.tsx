import Home from "@/views/home";
import { Routes, Route } from "react-router-dom";
import { Recorder } from "./components/recorder";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/video-player" element={<Recorder />} />
    </Routes>
  );
}

export default App;
