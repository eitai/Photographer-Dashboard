import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { WhatsAppButton } from '@/components/WhatsAppButton';

// Public pages
import { Portfolio } from './pages/Portfolio';
import { Contact } from './pages/Contact';
import { ClientGallery } from './pages/ClientGallery';
import { ClientProductsPage } from './pages/ClientProductsPage';
import { Blog } from './pages/Blog';
import { BlogPost } from './pages/BlogPost';
import { NotFound } from './pages/NotFound';

// Photographer public pages
import { PhotographerLayout } from './pages/photographer/PhotographerLayout';
import { PhotographerHome } from './pages/photographer/PhotographerHome';
import { PhotographerPortfolio } from './pages/photographer/PhotographerPortfolio';
import { PhotographerBlog } from './pages/photographer/PhotographerBlog';
import { PhotographerBlogPost } from './pages/photographer/PhotographerBlogPost';
import { PhotographerContact } from './pages/photographer/PhotographerContact';

// Admin pages
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminClients } from './pages/admin/AdminClients';
import { AdminClientDetail } from './pages/admin/AdminClientDetail';
import { AdminGalleryUpload } from './pages/admin/AdminGalleryUpload';
import { AdminSelections } from './pages/admin/AdminSelections';
import { AdminBlog } from './pages/admin/AdminBlog';
import { AdminBlogEditor } from './pages/admin/AdminBlogEditor';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminShowcase } from './pages/admin/AdminShowcase';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminContact } from './pages/admin/AdminContact';

const queryClient = new QueryClient();

// Layout wrapper for public pages (shows Navbar/Footer/WhatsApp)
const PublicLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Navbar />
    {children}
    <Footer />
    <WhatsAppButton />
  </>
);

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path='/' element={<Navigate to='/404' replace />} />
              <Route
                path='/portfolio'
                element={
                  <PublicLayout>
                    <Portfolio />
                  </PublicLayout>
                }
              />
              <Route
                path='/contact'
                element={
                  <PublicLayout>
                    <Contact />
                  </PublicLayout>
                }
              />
              <Route
                path='/blog'
                element={
                  <PublicLayout>
                    <Blog />
                  </PublicLayout>
                }
              />
              <Route
                path='/blog/:slug'
                element={
                  <PublicLayout>
                    <BlogPost />
                  </PublicLayout>
                }
              />
              <Route
                path='/gallery/:token'
                element={
                  <PublicLayout>
                    <ClientGallery />
                  </PublicLayout>
                }
              />
              <Route path='/products/:token' element={<ClientProductsPage />} />

              {/* Admin routes — no Navbar/Footer */}
              <Route path='/admin' element={<AdminLogin />} />
              <Route
                path='/admin/dashboard'
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/clients'
                element={
                  <ProtectedRoute>
                    <AdminClients />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/clients/:id'
                element={
                  <ProtectedRoute>
                    <AdminClientDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/galleries/:id'
                element={
                  <ProtectedRoute>
                    <AdminGalleryUpload />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/selections'
                element={
                  <ProtectedRoute>
                    <AdminSelections />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/blog'
                element={
                  <ProtectedRoute>
                    <AdminBlog />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/blog/new'
                element={
                  <ProtectedRoute>
                    <AdminBlogEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/blog/:id/edit'
                element={
                  <ProtectedRoute>
                    <AdminBlogEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/showcase'
                element={
                  <ProtectedRoute>
                    <AdminShowcase />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/settings'
                element={
                  <ProtectedRoute>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />

              <Route
                path='/admin/contact'
                element={
                  <ProtectedRoute>
                    <AdminContact />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin/users'
                element={
                  <ProtectedRoute superadminOnly>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />

              {/* Per-photographer public pages — must be last to avoid shadowing other routes */}
              <Route path='/:id' element={<PhotographerLayout />}>
                <Route index element={<PhotographerHome />} />
                <Route path='portfolio' element={<PhotographerPortfolio />} />
                <Route path='blog' element={<PhotographerBlog />} />
                <Route path='blog/:slug' element={<PhotographerBlogPost />} />
                <Route path='contact' element={<PhotographerContact />} />
              </Route>

              <Route path='/404' element={<NotFound />} />
              <Route path='*' element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
