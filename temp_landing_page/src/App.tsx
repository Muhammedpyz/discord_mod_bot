import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index.tsx";
import Commands from "./pages/Commands.tsx";
import Docs from "./pages/Docs.tsx";
import Changelog from "./pages/Changelog.tsx";
import About from "./pages/About.tsx";
import Privacy from "./pages/Privacy.tsx";
import DashboardHub from "./pages/DashboardHub.tsx";
import GuildDashboard from "./pages/GuildDashboard.tsx";
import TranscriptView from "./pages/TranscriptView.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/commands" element={<Commands />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/about" element={<About />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/dashboard" element={<DashboardHub />} />
                <Route path="/dashboard/:guildId" element={<GuildDashboard />} />
              </Route>
              {/* Standalone Full-screen Discord Transcript Viewer */}
              <Route path="/transcripts/:ticketId" element={<TranscriptView />} />
              <Route path="/dashboard/:guildId/transcripts/:ticketId" element={<TranscriptView />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
