import { AspectRatio } from "@/components/ui/aspect-ratio";

import { AppWindow, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  const handleScreenRecord = () => {
    navigate("/video-player");
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="gap-8 max-w-2xl mx-auto">
          <div className="group cursor-pointer" onClick={handleScreenRecord}>
            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105 overflow-hidden border border-gray-200">
              <AspectRatio ratio={1}>
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Monitor
                    size={100}
                    className="mb-4 group-hover:scale-110 transition-transform duration-300"
                  />
                  <h3 className="text-xl font-semibold mb-2">Full Screen</h3>
                  <p className="text-center text-sm">
                    Capture your entire desktop
                  </p>
                </div>
              </AspectRatio>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
