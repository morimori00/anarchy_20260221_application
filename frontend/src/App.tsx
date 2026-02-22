import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import MapOverview from "@/pages/map-overview";
import BuildingDetail from "@/pages/building-detail";
import UploadData from "@/pages/upload-data";
import Chatbot from "@/pages/chatbot";

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<MapOverview />} />
          <Route path="/buildings/:buildingNumber" element={<BuildingDetail />} />
          <Route path="/upload" element={<UploadData />} />
          <Route path="/chat" element={<Chatbot />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
