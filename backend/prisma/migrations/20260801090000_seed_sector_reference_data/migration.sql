-- `sector` is reference data the recruiter onboarding form selects from, so it
-- has to exist wherever the app runs rather than be seeded by hand per
-- environment. `label` is unique, which makes the insert idempotent and lets
-- this run again without duplicating rows or failing.
INSERT INTO "sector" ("label") VALUES
  ('Administration & Service public'),
  ('Agriculture & Agroalimentaire'),
  ('Architecture & Design'),
  ('Arts, Culture & Artisanat'),
  ('Automobile & Mobilité'),
  ('Banque, Assurance & Finance'),
  ('Bâtiment & Travaux publics'),
  ('Commerce & Distribution'),
  ('Communication, Marketing & Médias'),
  ('Conseil & Services aux entreprises'),
  ('Éducation & Formation'),
  ('Énergie & Environnement'),
  ('Hôtellerie, Restauration & Tourisme'),
  ('Immobilier'),
  ('Industrie & Ingénierie'),
  ('Informatique & Numérique'),
  ('Juridique'),
  ('Logistique & Supply chain'),
  ('Ressources humaines & Recrutement'),
  ('Santé & Médico-social'),
  ('Sport & Loisirs'),
  ('Télécommunications'),
  ('Transport'),
  ('Autre')
ON CONFLICT ("label") DO NOTHING;
