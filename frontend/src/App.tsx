import { Routes, Route } from "react-router-dom";
import { Recorder } from "./views/recorder";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Recorder />} />
    </Routes>
  );
}

export default App;
