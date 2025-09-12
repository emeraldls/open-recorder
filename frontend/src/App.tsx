import Home from "@/views/home";
import { Routes, Route } from "react-router-dom";
import { VideoPlayer } from "./components/video-player";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/video-player" element={<VideoPlayer />} />
    </Routes>
  );
}

export default App;
