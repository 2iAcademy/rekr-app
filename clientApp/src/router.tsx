import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { RootLayout } from '@/components/layout/RootLayout';
import { AnonymousOnly } from '@/features/auth/AnonymousOnly';
import { HomeRedirect } from '@/features/auth/HomeRedirect';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { CandidateOnboardingRoute } from '@/features/candidate-onboarding/routes';
import { CandidateFeedRoute } from '@/features/candidate-feed/routes';
import { ConversationRoute } from '@/features/conversation/routes';
import { MatchRoute, MatchesRoute } from '@/features/matches/routes';
import {
  ForgotPasswordRoute,
  ResetPasswordRoute,
  SigninRoute,
  SignupRoute,
  SplashRoute,
} from '@/features/onboarding/routes';
import { LegalNoticeRoute, PrivacyPolicyRoute, SiteMapRoute } from '@/features/legal/routes';
import { OfferDetailRoute } from '@/features/offers/routes';
import { ProfileRoute } from '@/features/profile/routes';
import { OfferApplicantsRoute } from '@/features/recruiter-candidates/routes';
import { OfferFormRoute, RecruiterOffersRoute } from '@/features/recruiter-offers/routes';
import { RecruiterOnboardingRoute } from '@/features/recruiter-onboarding/routes';

export const routes = [
  {
    // Above every layout: the skip link has to be the first thing Tab reaches.
    element: <RootLayout />,
    children: [
      {
        element: <AnonymousOnly />,
        children: [
          { path: '/', handle: { title: 'Accueil' }, element: <SplashRoute /> },
          { path: '/inscription', handle: { title: 'Créer un compte' }, element: <SignupRoute /> },
          { path: '/connexion', handle: { title: 'Connexion' }, element: <SigninRoute /> },
          {
            path: '/mot-de-passe-oublie',
            handle: { title: 'Mot de passe oublié' },
            element: <ForgotPasswordRoute />,
          },
          {
            path: '/reinitialiser-mot-de-passe',
            handle: { title: 'Nouveau mot de passe' },
            element: <ResetPasswordRoute />,
          },
        ],
      },

      // Under neither guard: read before an account exists, and reread after.
      {
        path: '/confidentialite',
        handle: { title: 'Politique de confidentialité' },
        element: <PrivacyPolicyRoute />,
      },
      {
        path: '/mentions-legales',
        handle: { title: 'Mentions légales' },
        element: <LegalNoticeRoute />,
      },
      {
        path: '/plan-du-site',
        handle: { title: 'Plan du site' },
        element: <SiteMapRoute />,
      },

      {
        path: '/candidat/onboarding',
        handle: { title: 'Mon profil candidat' },
        element: <CandidateOnboardingRoute />,
      },
      {
        path: '/recruteur/onboarding',
        handle: { title: 'Mon entreprise' },
        element: <RecruiterOnboardingRoute />,
      },
      {
        element: <RouteGuard profile="complete" />,
        children: [
          {
            path: '/offres/:id',
            handle: { title: 'Détail de l’offre' },
            element: <OfferDetailRoute />,
          },
          { path: '/match', handle: { title: 'C’est un match' }, element: <MatchRoute /> },
          // Full screen, outside the shell: the thread and its composer need the
          // whole height, the bottom navigation would sit on the composer.
          {
            path: '/matches/:matchId/conversation',
            handle: { title: 'Conversation' },
            element: <ConversationRoute />,
          },
          {
            element: <AppShell />,
            children: [
              { path: '/matches', handle: { title: 'Activité' }, element: <MatchesRoute /> },
              {
                path: '/recruteur/offres',
                handle: { title: 'Vos offres' },
                element: <RecruiterOffersRoute />,
              },
              // Declared before the dynamic sibling, which is where a reader looks
              // for the answer; react-router ranks by specificity, so the order is a
              // convention here rather than the thing that keeps them apart.
              {
                path: '/recruteur/offres/nouvelle',
                handle: { title: 'Nouvelle offre' },
                element: <OfferFormRoute />,
              },
              {
                path: '/recruteur/offres/:id/edition',
                handle: { title: 'Modifier l’offre' },
                element: <OfferFormRoute />,
              },
              {
                path: '/recruteur/offres/:id/candidats',
                handle: { title: 'Candidats intéressés' },
                element: <OfferApplicantsRoute />,
              },
              {
                path: '/candidat/offres',
                handle: { title: 'Fil d’offres' },
                element: <CandidateFeedRoute />,
              },
              { path: '/profil', handle: { title: 'Mon compte' }, element: <ProfileRoute /> },
            ],
          },
        ],
      },

      { path: '*', element: <HomeRedirect /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
