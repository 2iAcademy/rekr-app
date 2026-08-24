-- Widens the tag dictionary key from the label alone to (label, category).
-- « Anglais » is both a plausible skill and the canonical name of a language:
-- under the old index the first writer fixed the category for every user, and
-- no later payload could correct it. Purely additive for existing rows — the
-- old index only allowed one row per label, so every pair is already unique.
DROP INDEX "tag_label_key";

CREATE UNIQUE INDEX "tag_label_category_key" ON "tag"("label", "category");
