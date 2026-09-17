# ParsPack Production Snapshot Audit

This document records non-secret migration invariants from the production snapshot supplied for the VPS migration. The raw SQL dump is sensitive because it includes password hashes and must never be committed.

## Publication state

- `menu_state.edit_revision`: 65
- `menu_state.published_revision`: 65
- public `current.json`: revision 65
- public `previous.json`: revision 64
- revision 65 snapshot SHA-256: `3faeebfaa7c786c0d9e5c1ddfd5fd233f2550726c64028d741b9cec74f4fe3d7`
- revision 64 snapshot SHA-256: `dd35c31b4af97313a324dbab90bee03ee53f49345ce8ceb3951d6248ec2d0f0e`

The supplied `current.json` and `previous.json` byte hashes match their corresponding published `menu_revisions` rows.

## Database baseline

- categories: 12 active categories
- menu items: 97 total
- active menu items: 90
- archived menu items: 7
- item options: 35
- media assets: 126
- menu revisions: 65
- admin roles present: owner and cashier
- schema migrations present: 001 through 004

The 90 active database item public IDs exactly match the 90 items in revision 65 `current.json`.

## Managed media baseline

- expected renditions from DB: 252
- supplied `managed-media` files: 252
- missing renditions: 0
- extra renditions: 0
- ZIP integrity/CRC errors: 0

Every public image referenced by `current.json`/`previous.json` is present in the supplied managed-media snapshot.

## Revision archive baseline

The supplied revision archive contains the full sequence from revision 1 through revision 65 with no missing revision. Revision archive validation is hash-based; filenames are not treated as authority.

## 64 -> 65 observed change

Revision 65 removes the prior `کروسان نان وپنیر` public item and adds/updates public image references for three items, including `بلک فارست`, `گلدن آلموند`, and `لقمه صبحانه`.

## Migration acceptance rule

A generated SQLite database is not accepted merely because import exits successfully. `verify-import.mjs` must confirm:

1. SQLite integrity and foreign keys;
2. edit/published state is 65/65 for this snapshot;
3. `current.json` revision/hash matches revision 65;
4. `previous.json` revision/hash matches revision 64;
5. active category and item public IDs match `current.json`;
6. all 252 public media renditions are present;
7. all hashed database revisions exist in the supplied private revision archive when that archive is part of the verification run.
