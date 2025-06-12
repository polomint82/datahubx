import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import Dashboard from "@/pages/dashboard";
import Import from "@/pages/import";
import Datasets from "@/pages/datasets";
import PropertyMaps from "@/pages/property-maps";
import Transformations from "@/pages/transformations";
import Jobs from "@/pages/jobs";
import ImportStatus from "@/pages/import-status";
import Admin from "@/pages/admin";
import FileExplorer from "@/pages/file-explorer";
import Team from "@/pages/team";
import { FileExplorerMockup } from "@/components/file-explorer-mockup";
import Pipelines from "@/pages/pipelines";
import TestDashboard from "@/pages/test-dashboard";
import { SarifAnalyzer } from "@/pages/sarif-analyzer";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto w-full">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/import" component={Import} />
            <Route path="/datasets" component={Datasets} />
            <Route path="/property-maps" component={PropertyMaps} />
            <Route path="/transformations" component={Transformations} />
            <Route path="/jobs" component={Jobs} />
            <Route path="/jobs/:jobId/status" component={ImportStatus} />
            <Route path="/pipelines" component={Pipelines} />
            <Route path="/team" component={Team} />
            <Route path="/admin" component={Admin} />
            <Route path="/files" component={FileExplorer} />
            <Route path="/tests" component={TestDashboard} />
            <Route path="/sarif" component={SarifAnalyzer} />
            <Route path="/mockup" component={FileExplorerMockup} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
