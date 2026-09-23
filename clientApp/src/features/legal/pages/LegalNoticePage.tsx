import { LegalLayout, LegalSection } from '@/features/legal/components/LegalLayout';
import { PRIVACY_POLICY_VERSION_LABEL } from '@/features/legal/policy';

interface LegalNoticePageProps {
  onBack?: () => void;
}

/**
 * The legal notice and the terms of use, on one page: the sign-up form links
 * « CGU » here. The identity fields are fictitious placeholders (`.example`
 * addresses, a zero SIREN) until the publisher's real details are known.
 */
export function LegalNoticePage({ onBack }: LegalNoticePageProps) {
  return (
    <LegalLayout title="Mentions légales" version={PRIVACY_POLICY_VERSION_LABEL} onBack={onBack}>
      <LegalSection title="Éditeur">
        <p>Rekr SAS, société par actions simplifiée au capital de 1 000 €</p>
        <p>Siège : 12 rue de l’Exemple, 75011 Paris</p>
        <p>SIREN : 000 000 000 · contact@rekr.example</p>
        <p>Directrice de la publication : Camille Martin</p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>Hébergeur Exemple SAS, 1 avenue du Serveur, 69000 Lyon · 01 23 45 67 89</p>
      </LegalSection>

      <LegalSection title="Conditions d’utilisation">
        <ul>
          <li>Le service est réservé aux personnes cherchant un emploi et aux recruteurs.</li>
          <li>
            Vous vous engagez à fournir des informations exactes et à ne publier ni contenu
            illicite, ni offre fictive, ni donnée concernant un tiers sans son accord.
          </li>
          <li>
            Vous pouvez supprimer votre compte à tout moment depuis l’écran Mon compte ; un compte
            qui enfreint ces conditions peut être désactivé.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Leur traitement est décrit dans la{' '}
          <a href="/confidentialite" className="font-medium underline underline-offset-2">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
