import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nProvider } from '@/lib/i18n';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { WhatsAppButton } from '@/components/WhatsAppButton';

// Public pages
const Index = lazy(() => import('./pages/Index').then((m) => ({ default: m.Index })));
const Portfolio = lazy(() => import('./pages/Portfolio').then((m) => ({ default: m.Portfolio })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const ClientGallery = lazy(() => import('./pages/ClientGallery').then((m) => ({ default: m.ClientGallery })));
const ClientProductsPage = lazy(() => import('./pages/ClientProductsPage').then((m) => ({ default: m.ClientProductsPage })));
const Blog = lazy(() => import('./pages/Blog').then((m) => ({ default: m.Blog })));
const BlogPost = lazy(() => import('./pages/BlogPost').then((m) => ({ default: m.BlogPost })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

// Photographer public pages
const PhotographerLayout = lazy(() => import('./pages/photographer/PhotographerLayout').then((m) => ({ default: m.PhotographerLayout })));
const PhotographerHome = lazy(() => import('./pages/photographer/PhotographerHome').then((m) => ({ default: m.PhotographerHome })));
const PhotographerPortfolio = lazy(() => import('./pages/photographer/PhotographerPortfolio').then((m) => ({ default: m.PhotographerPortfolio })));
const PhotographerBlog = lazy(() => import('./pages/photographer/PhotographerBlog').then((m) => ({ default: m.PhotographerBlog })));
const PhotographerBlogPost = lazy(() => import('./pages/photographer/PhotographerBlogPost').then((m) => ({ default: m.PhotographerBlogPost })));
const PhotographerContact = lazy(() => import('./pages/photographer/PhotographerContact').then((m) => ({ default: m.PhotographerContact })));

// Admin pages
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminClients = lazy(() => import('./pages/admin/AdminClients').then((m) => ({ default: m.AdminClients })));
const AdminClientDetail = lazy(() => import('./pages/admin/AdminClientDetail').then((m) => ({ default: m.AdminClientDetail })));
const AdminGalleryUpload = lazy(() => import('./pages/admin/AdminGalleryUpload').then((m) => ({ default: m.AdminGalleryUpload })));
const AdminSelections = lazy(() => import('./pages/admin/AdminSelections').then((m) => ({ default: m.AdminSelections })));
const AdminBlog = lazy(() => import('./pages/admin/AdminBlog').then((m) => ({ default: m.AdminBlog })));
const AdminBlogEditor = lazy(() => import('./pages/admin/AdminBlogEditor').then((m) => ({ default: m.AdminBlogEditor })));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })));
const AdminShowcase = lazy(() => import('./pages/admin/AdminShowcase').then((m) => ({ default: m.AdminShowcase })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminContact = lazy(() => import('./pages/admin/AdminContact').then((m) => ({ default: m.AdminContact })));
// Dev-only test harness for the multipart S3 uploader. Gated by `?s3test=1`
// query param inside the page itself AND by `import.meta.env.DEV` at the
// route level, so it cannot ship to production builds.
const S3UploadTest = lazy(() => import('./pages/admin/_S3UploadTest').then((m) => ({ default: m.S3UploadTest })));

export const queryClient = new QueryClient();

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
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={null}>
                <Routes>
                  {/* Public routes */}
                  <Route path='/' element={<Index />} />
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
                <Route path='/gallery/:token' element={<ClientGallery />} />
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
                {/* Dev-only S3 uploader test harness. Reach via /admin/_s3test?s3test=1 */}
                {import.meta.env.DEV && (
                  <Route
                    path='/admin/_s3test'
                    element={
                      <ProtectedRoute>
                        <S3UploadTest />
                      </ProtectedRoute>
                    }
                  />
                )}

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
              </Suspense>
            </BrowserRouter>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);
