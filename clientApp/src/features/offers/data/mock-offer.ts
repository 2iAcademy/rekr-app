export interface Offer {
  id: string;
  title: string;
  company: string;
  companySize: string;
  companyLogo: string;
  type: string;
  location: string;
  salary: string;
  stack: string[];
  aboutRole: string;
  aboutCompany: string;
}

export const mockOffer: Offer = {
  id: '1',
  title: 'Développeur Full-Stack',
  company: 'Acme Corp',
  companySize: 'PME',
  companyLogo: '',
  type: 'CDI',
  location: 'Lyon',
  salary: '45 - 55 k€ selon expérience',
  stack: ['React', 'Node', 'TypeScript', 'PostgreSQL', 'AWS', 'Docker', 'Remote OK'],
  aboutRole:
    "Équipe de 8 personnes, produit principal en forte croissance. Stack moderne, autonomie sur les choix techniques et environnement bienveillant.",
  aboutCompany:
    "Acme Corp construit des outils SaaS pour PME industrielles. Fondée en 2018, basée à Lyon, 35 personnes.",
};
