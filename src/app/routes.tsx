import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { RouteLoading } from './RouteLoading';

/**
 * Route table. Pages are lazy-loaded so chart-heavy screens don't slow the
 * initial load. The editor itself is full-screen (outside the app shell).
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }) },
      { path: 'gallery', lazy: async () => ({ Component: (await import('@/pages/GalleryPage')).GalleryPage }) },
      { path: 'gallery/:templateId', lazy: async () => ({ Component: (await import('@/pages/TemplateDetailPage')).TemplateDetailPage }) },
      { path: 'themes', lazy: async () => ({ Component: (await import('@/pages/ThemesLayoutsPage')).ThemesLayoutsPage }) },
      { path: 'editor', lazy: async () => ({ Component: (await import('@/pages/EditorLauncherPage')).EditorLauncherPage }) },
      { path: 'import', lazy: async () => ({ Component: (await import('@/pages/ImportHtmlPage')).ImportHtmlPage }) },
      { path: 'assistant', lazy: async () => ({ Component: (await import('@/pages/AssistantPage')).AssistantPage }) },
      { path: '*', lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }) },
    ],
  },
  {
    path: '/editor/new',
    errorElement: <RouteError />,
    hydrateFallbackElement: <RouteLoading />,
    lazy: async () => ({ Component: (await import('@/pages/EditorNewPage')).EditorNewPage }),
  },
  {
    path: '/editor/:designId',
    errorElement: <RouteError />,
    hydrateFallbackElement: <RouteLoading />,
    lazy: async () => ({ Component: (await import('@/pages/EditorPage')).EditorPage }),
  },
]);
