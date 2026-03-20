import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "./components/layout/AppLayout";
import Settings from "./pages/Settings";
import Videos from "./pages/Videos";
import Profiles from "./pages/Profiles";
import PublishWizard from "./pages/PublishWizard";
import Scraper from "./pages/Scraper";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Products from "./pages/Products";
import ContentGen from "./pages/ContentGen";
import PipelineRuns from "./pages/PipelineRuns";
import SetupWizard from "./pages/SetupWizard";
import { getSetupStatus } from "./api/appSettings";

export default function App() {
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const { data: setupStatus } = useQuery({
    queryKey: ["setup-status"],
    queryFn: getSetupStatus,
  });
  const showWizard = setupStatus?.needs_setup === true && !wizardDismissed;

  return (
    <>
      <SetupWizard open={showWizard} onFinish={() => setWizardDismissed(true)} />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/publish" element={<PublishWizard />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/scraper" element={<Scraper />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/products" element={<Products />} />
          <Route path="/content" element={<ContentGen />} />
          <Route path="/pipeline" element={<PipelineRuns />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
