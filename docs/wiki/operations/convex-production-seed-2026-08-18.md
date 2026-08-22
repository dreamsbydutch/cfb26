# Convex production seed — 2026-08-18

[Operations index](README.md) · [Wiki home](../README.md)

## Outcome

**Historical operation:** production deployment `doting-chipmunk-7` was seeded with the declared schema, indexes, and database snapshot from development deployment `adjoining-opossum-710` in Convex project `dreamsbydutch:michigan`.

The migration created 3,091 user documents across eight tables. It preserved Convex document IDs and creation times, so cross-table references remain intact. Neither deployment had file-storage objects.

## Post-seed corrections

On 2026-08-22, the owner confirmed that Jeremiah Beasley's source row was invalid. His seven linked documents—the player, recruiting profile, roster stint, career summary, legacy row, arrival event, and departure event—were removed atomically from both deployments. Bryce Underwood's redshirt count was then corrected from 1 to 0 in his normalized stint and legacy row. Owen Wafle's 2024 recruit rank was corrected from R26 to R25 in his profile, arrival event, and legacy row.

A subsequent direct read of every table found 3,084 documents in each deployment with identical contents. Underwood's eligibility formula now resolves, the 2024 high-school recruit ranks form a complete R1–R25 sequence, and no Beasley reference remains. The original counts and hashes below remain the historical evidence for the seed operation; the archived snapshot is also the corrections' recovery source.

## Evidence

| Check                      | Result                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Production preflight       | Zero tables, documents, and deployed functions                                                                         |
| Development snapshot       | 8 user tables, 3,091 documents, 0 files                                                                                |
| Declared schema comparison | 8 normalized table definitions matched; SHA-256 `ce68b6606a707b765d3a8d0c3d27c3ba59c505e07d5273d65008fd53bb020a51`     |
| Production schema push     | All validators plus 18 database indexes and 1 search index activated                                                   |
| Data import                | Non-replacing snapshot import created 3,091 documents and deleted none                                                 |
| Post-import snapshot       | All 18 non-README ZIP entries matched development by length and SHA-256                                                |
| Post-migration drift check | Fresh development and production ZIPs share SHA-256 `4dfa90949d281e6a20d688defe5c0481e743d7059e25cd4e9e625c3307be3cbf` |

Convex snapshots were taken for source development, pre-migration production, post-migration production, and a final development drift check. The operator copies are outside the repository because snapshots can contain production data and must never be committed.

## Scope boundary

The migration copied schema, indexes, database documents, and file storage (empty). It did **not** copy deployment environment variables or the development deployment's functions. Production therefore has the data model but no public/internal application functions.

The checked-in `convex/` directory now represents the hosted schema and public football reads, but the development deployment's internal legacy-import function source remains unrecovered and no push-validation has occurred. Running development/deployment commands could remove those functions or change hosted configuration. Review parity and authorize a development push before attaching local development or Vercel.

## Recovery

- The pre-migration production snapshot represents the empty database state.
- The development snapshot is the canonical seed used for this operation.
- The post-migration production snapshot is the verification copy.
- Any rollback that removes the active schema/indexes requires an explicit reviewed deployment; importing the empty snapshot alone would not restore the prior schema-less configuration.
