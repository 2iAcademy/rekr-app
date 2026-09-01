-- Benefits move from the company to the offer: two posts of the same employer
-- rarely come with the same perks, and the candidate reads them on the offer
-- they are about to like.
--
-- Nothing changes in the schema — `offer_tag` already exists and `benefit` is
-- already a `tag_category`. Only the rows are copied: each company's benefits
-- land on every offer it owns.
--
-- Additive on purpose. The obvious companion — deleting the `company_tag` rows
-- once copied — is deliberately left out: after this release nothing reads or
-- writes that pivot, so removing the rows buys nothing while making the change
-- irreversible, and it would silently drop the benefits of a company that has
-- no offer yet to carry them. Those rows are dead, not harmful; clearing them
-- belongs to a later migration, once this one has been observed in staging.
--
-- Idempotent: the copy leans on the `(fk_offer, fk_tag)` primary key through
-- ON CONFLICT, so a second run inserts nothing.
INSERT INTO "offer_tag" ("fk_offer", "fk_tag")
SELECT o."id", ct."fk_tag"
FROM "company_tag" AS ct
JOIN "offer" AS o ON o."fk_company" = ct."fk_company"
JOIN "tag" AS t ON t."id" = ct."fk_tag"
WHERE t."category" = 'benefit'
ON CONFLICT ("fk_offer", "fk_tag") DO NOTHING;
