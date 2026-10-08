import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { isCandidate } from '@/domain/userType';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { backPath } from '@/lib/backPath';

const ConversationPage = lazy(() => import('./pages/ConversationPage'));

export function ConversationRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const matchId = Number(useParams().matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return <Navigate to="/matches" replace />;
  }

  return (
    <RouteGuard>
      {(user) => (
        <Suspense
          fallback={
            <main className="flex h-dvh items-center justify-center bg-background">
              <p className="text-sm text-ink-muted">Chargement…</p>
            </main>
          }
        >
          <ConversationPage
            matchId={matchId}
            viewerIsCandidate={isCandidate(user.userType)}
            onBack={() => navigate(backPath(location.state, '/matches'))}
          />
        </Suspense>
      )}
    </RouteGuard>
  );
}
