import { RouterProvider } from 'react-router';
import { router } from '@/router';
import { AuthProvider } from '@/features/auth/AuthProvider';

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
