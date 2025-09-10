import { Toaster } from "@/components/ui/toaster";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FileProvider } from "@/contexts/FileContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardIndex from "./pages/DashboardIndex";
import WorkspacePage from "./pages/WorkspacePage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import FilePreviewPage from "./pages/FilePreviewPage";
import DocumentPreviewPage from "./pages/DocumentPreviewPage";
import ChatPage from "./pages/ChatPage";
import GeneratePage from "./pages/GeneratePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <FileProvider>
                        <DashboardIndex />
                      </FileProvider>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/workspace/:workspaceId" 
                  element={
                    <ProtectedRoute>
                      <FileProvider>
                        <WorkspacePage />
                      </FileProvider>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/file/:fileId" 
                  element={
                    <ProtectedRoute>
                      <FileProvider>
                        <FilePreviewPage />
                      </FileProvider>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/document/:fileId" 
                  element={
                    <ProtectedRoute>
                      <FileProvider>
                        <DocumentPreviewPage />
                      </FileProvider>
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="/chat" 
                  element={
                    <ProtectedRoute>
                      <FileProvider>
                        <ChatPage />
                      </FileProvider>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/generate" 
                  element={
                    <ProtectedRoute>
                      <FileProvider>
                        <GeneratePage />
                      </FileProvider>
                    </ProtectedRoute>
                  } 
                />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SidebarProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
