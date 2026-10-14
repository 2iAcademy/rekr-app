import { Link } from 'react-router';
import { LegalLayout, LegalSection } from '@/features/legal/components/LegalLayout';

interface SiteMapPageProps {
  onBack?: () => void;
}

interface Entry {
  to: string;
  label: string;
}

// A screen reserved to the other account type, or to a signed-in user, sends
// its reader to the right place through the route guards: listing it is safe.
const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Pour tous',
    entries: [
      { to: '/', label: 'Accueil' },
      { to: '/inscription', label: 'Créer un compte' },
      { to: '/connexion', label: 'Connexion' },
      { to: '/mot-de-passe-oublie', label: 'Mot de passe oublié' },
      { to: '/mentions-legales', label: 'Mentions légales et conditions d’utilisation' },
      { to: '/confidentialite', label: 'Politique de confidentialité' },
    ],
  },
  {
    title: 'Candidat',
    entries: [
      { to: '/candidat/offres', label: 'Fil d’offres' },
      { to: '/matches', label: 'Activité : matchs et offres likées' },
      { to: '/profil', label: 'Mon compte' },
    ],
  },
  {
    title: 'Recruteur',
    entries: [
      { to: '/recruteur/offres', label: 'Vos offres' },
      { to: '/recruteur/offres/nouvelle', label: 'Nouvelle offre' },
      { to: '/matches', label: 'Activité : matchs et candidats intéressés' },
      { to: '/profil', label: 'Mon compte' },
    ],
  },
];

/** Every page a reader can open from a link, grouped by who it is for. */
export function SiteMapPage({ onBack }: SiteMapPageProps) {
  return (
    <LegalLayout title="Plan du site" onBack={onBack}>
      {SECTIONS.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          <ul>
            {section.entries.map((entry) => (
              <li key={entry.to}>
                <Link to={entry.to} className="underline underline-offset-2">
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </LegalSection>
      ))}
    </LegalLayout>
  );
}
