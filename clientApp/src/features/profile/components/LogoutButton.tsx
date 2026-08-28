import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { LOGOUT_SUCCESS } from '@/features/profile/accountFeedback';
import { notifySuccess } from '@/lib/feedback/notify';

export function LogoutButton() {
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  // No re-entrancy guard: `leaving` is captured per render, so two clicks in the
  // same tick would both read it as false. `disabled` is what actually holds.
  const end = async () => {
    setLeaving(true);

    try {
      await logout();
    } catch {
      // AuthProvider drops the token and the drafts in a `finally` and rethrows:
      // whatever the server answered, the session is over on this device. Saying
      // it failed would contradict what the user is about to see.
    }

    // No reset: the shell guard sends an anonymous session to /connexion, so
    // there is no state to come back to.
    notifySuccess(LOGOUT_SUCCESS);
  };

  return (
    <Button variant="destructive" size="lg" disabled={leaving} onClick={end}>
      Se déconnecter
    </Button>
  );
}
