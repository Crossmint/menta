-- Approvals no longer have avatars. A preview build of the branch that added
-- them created this table, so drop it wherever that ran.
-- (No semicolons in comments: scripts/migrate.mjs splits statements on them.)
DROP TABLE IF EXISTS approval_avatars
