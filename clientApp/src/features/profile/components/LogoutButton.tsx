import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/useAuth';
import { LOGOUT_SUCCESS } from '@/features/profile/accountFeedback';
import { notifySuccess } from '@/lib/feedback/notify';

interface LogoutButtonProps {
  /**
   * How the chrome around it needs it to look. `inline` is the full-width entry
   * of the sidebar and the mobile menu; `icon` is the tablet header, where the
   * bar is already crowded and only the icon fits.
   */
  appearance?: 'inline' | 'icon';
  className?: string;
}

const LABEL = 'Se déconnecter';

export function LogoutButton({ appearance = 'inline', className }: LogoutButtonProps) {
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

  if (appearance === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={LABEL}
        disabled={leaving}
        onClick={end}
        className={cn('text-ink-muted hover:text-destructive', className)}
      >
        <LogOut aria-hidden="true" className="size-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="lg"
      disabled={leaving}
      onClick={end}
      className={cn(
        'min-h-11 justify-start gap-2 px-2 text-ink-muted hover:text-destructive',
        className,
      )}
    >
      <LogOut aria-hidden="true" className="size-4 shrink-0" />
      {LABEL}
    </Button>
  );
}
