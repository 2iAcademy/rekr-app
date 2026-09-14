// Mirrors `tag.label @db.VarChar(100)`: a longer label could never be stored.
export const MAX_TAG_LABEL_LENGTH = 100;

// Cardinality cap shared by candidate skills and offer skills. Well above any
// realistic profile, low enough that a single request cannot turn the tag table
// into a write amplifier.
export const MAX_SKILLS = 50;

export const MAX_BENEFITS = 50;

export const MAX_LANGUAGES = 50;
