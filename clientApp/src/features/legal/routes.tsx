import { useLocation, useNavigate } from 'react-router';
import { LegalNoticePage } from '@/features/legal/pages/LegalNoticePage';
import { PrivacyPolicyPage } from '@/features/legal/pages/PrivacyPolicyPage';

// The sign-up form opens these pages in a new tab, whose history holds no
// entry of the app: going back there would do nothing, or leave the site.
function useBack() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => void (key === 'default' ? navigate('/') : navigate(-1));
}

export function PrivacyPolicyRoute() {
  return <PrivacyPolicyPage onBack={useBack()} />;
}

export function LegalNoticeRoute() {
  return <LegalNoticePage onBack={useBack()} />;
}
