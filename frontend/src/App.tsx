import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import MapOverview from "@/pages/map-overview";
import BuildingDetail from "@/pages/building-detail";
import UploadData from "@/pages/upload-data";
import Chatbot from "@/pages/chatbot";
import { ThresholdsContext, useThresholdsProvider } from "@/hooks/use-thresholds";

function ThresholdsProvider({ children }: { children: React.ReactNode }) {
  const value = useThresholdsProvider();
  return (
    <ThresholdsContext.Provider value={value}>
      {children}
    </ThresholdsContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThresholdsProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<MapOverview />} />
            <Route path="/buildings/:buildingNumber" element={<BuildingDetail />} />
            <Route path="/upload" element={<UploadData />} />
            <Route path="/chat" element={<Chatbot />} />
          </Routes>
        </AppLayout>
      </ThresholdsProvider>
    </BrowserRouter>
  );
}

export default App;
