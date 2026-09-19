# KDS Client Digital Card — Security Notes

## Data access
- Public cards are served through `public_client_cards`.
- The public view exposes only card-display fields.
- Inactive and expired cards are excluded at the database layer.
- Direct public table access to `client_cards` is revoked.

## Admin access
- Admin UI requires a Supabase session.
- The signed-in user must exist in `public.admin_users`.
- Database writes are protected by admin-only RLS policies.
- The old first-admin self-claim path is disabled.

## Storage
- Card images use the `card-assets` bucket.
- Public users can read published card assets.
- Only verified admins can upload, replace, or delete assets.
- Maximum configured object size is 5 MB.

## Frontend keys
The Supabase publishable key may be present in browser code. Never place a Supabase service-role/secret key in this repository.

## Deployment
Use HTTPS. GitHub Pages is suitable for the static frontend. Supabase provides the database, authentication and storage.
