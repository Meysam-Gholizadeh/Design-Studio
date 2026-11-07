import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/common/Toaster';
import { router } from './routes';

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
