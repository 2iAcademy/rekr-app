import { LegalLayout, LegalSection } from '@/features/legal/components/LegalLayout';
import {
  INACTIVE_ACCOUNT_RETENTION_MONTHS,
  PRIVACY_POLICY_VERSION_LABEL,
} from '@/features/legal/policy';

interface PrivacyPolicyPageProps {
  onBack?: () => void;
}

/**
 * Written from what the code does, not from a template: every retention period
 * and every deletion rule stated here is one the API enforces. The publisher's
 * identity is fictitious (a `.example` address, a zero SIREN) until the real
 * one is known.
 */
export function PrivacyPolicyPage({ onBack }: PrivacyPolicyPageProps) {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      version={PRIVACY_POLICY_VERSION_LABEL}
      onBack={onBack}
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Rekr est édité par Rekr SAS, 12 rue de l’Exemple, 75011 Paris. Pour toute question sur vos
          données : dpo@rekr.example.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <ul>
          <li>
            Compte : adresse e-mail, mot de passe (stocké haché, jamais en clair), type de compte.
          </li>
          <li>
            Profil candidat : nom, prénom, photo, présentation, ville, métiers et compétences
            recherchés, disponibilité, mobilité, prétentions salariales, lien LinkedIn, CV.
          </li>
          <li>Profil recruteur : nom, prénom, fonction, et la fiche de votre entreprise.</li>
          <li>Activité : likes, passages et matchs, dates de connexion.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Finalités et base légale">
        <p>
          Ces données servent à faire se rencontrer candidats et recruteurs : afficher les offres et
          les profils pertinents, et créer un match quand l’intérêt est réciproque. Le traitement
          repose sur votre consentement, recueilli à l’inscription, et sur l’exécution du service
          que vous demandez en créant un compte.
        </p>
      </LegalSection>

      <LegalSection title="Qui voit vos données">
        <ul>
          <li>
            Les recruteurs voient le profil des candidats qui ont liké une de leurs offres ; le CV
            n’est jamais public.
          </li>
          <li>Les candidats voient les offres et la fiche des entreprises.</li>
          <li>
            Sous-traitants techniques : l’hébergeur de l’application, et Sentry pour le suivi des
            erreurs. Aucune donnée n’est vendue ni cédée.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Vos données sont conservées tant que votre compte est actif. Un compte resté{' '}
          {INACTIVE_ACCOUNT_RETENTION_MONTHS} mois sans connexion est supprimé, avec les mêmes
          effets qu’une suppression demandée par vous.
        </p>
      </LegalSection>

      <LegalSection title="Suppression du compte">
        <p>
          La suppression est immédiate et définitive. Elle efface votre compte, votre profil, vos CV
          et photo, vos likes, passages et matchs, ainsi que vos sessions ouvertes.
        </p>
        <p>
          Pour un recruteur, si vous êtes le dernier membre de votre entreprise, la fiche de
          l’entreprise, ses offres et ses images sont supprimées avec vous. Si un collègue y est
          encore rattaché, elles restent sous sa responsabilité ; vos offres perdent seulement leur
          auteur.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous disposez d’un droit d’accès, de rectification, d’effacement, de portabilité et
          d’opposition. Depuis l’écran Mon compte, vous pouvez à tout moment modifier votre profil,
          télécharger une copie de vos données au format JSON, et supprimer votre compte.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation
          à la CNIL (cnil.fr).
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Rekr ne dépose qu’un cookie, strictement nécessaire : celui qui maintient votre session
          ouverte. Aucun cookie de mesure d’audience ni de publicité n’est utilisé.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
