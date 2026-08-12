import { RichTextField } from '@/components/form/RichTextField';
import { TagInput } from '@/components/form/TagInput';
import { TextField } from '@/components/form/TextField';
import { markGroupIfInvalid, markIfInvalid } from '@/components/wizard/wizardError';
import { MAX_FREE_TEXT_LENGTH } from '@/lib/bounds';
import type { StepProps } from './stepProps';

export function ShowcaseStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <TagInput
        label="Compétences"
        placeholder="React, TypeScript, Figma…"
        values={state.skills}
        onChange={(skills) => onChange({ skills })}
        {...markGroupIfInvalid(invalidField, 'skills')}
      />

      <TagInput
        label="Langues (optionnel)"
        placeholder="Anglais, Espagnol…"
        values={state.languages}
        onChange={(languages) => onChange({ languages })}
      />

      <RichTextField
        label="À propos de moi"
        aria-required
        {...markIfInvalid(invalidField, 'bio')}
        maxLength={MAX_FREE_TEXT_LENGTH}
        value={state.bio}
        onChange={(bio) => onChange({ bio })}
        placeholder="Votre parcours, ce que vous cherchez, ce qui vous motive…"
      />

      <TextField
        label="Profil LinkedIn (optionnel)"
        type="url"
        autoComplete="url"
        maxLength={255}
        value={state.linkedinUrl}
        onChange={(event) => onChange({ linkedinUrl: event.target.value })}
        placeholder="https://linkedin.com/in/camille-martin"
      />
    </>
  );
}
