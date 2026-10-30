# Second Chances

Preowned item storefront for Ganicon Electrics (Pty) Ltd.

The site stays in `index.html`, with its existing layout, categories, email/WhatsApp enquiries, and Supabase email/password login. The GitHub repository is https://github.com/Kalel1177/second-chances.

## Photo and save update — 28 October 2026

- Add up to six JPG, PNG, or WebP photos per listing, together or in separate selections. Each original must be at most 10 MB. The browser resizes photos to a maximum dimension of 1,200 pixels and converts them to JPEG before upload.
- Review previews, remove a selection, or choose a cover before saving. Buyers can use View photos, thumbnails, Previous/Next, or the left/right arrow keys in the gallery.
- Existing single-photo listings still display and edit correctly. An old embedded photo is retained when editing; new photos are saved to the existing `item-photos` Storage bucket. The database `images` array holds the gallery and `image` remains the cover for compatibility.
- Available items can be ordered. Sold items show Sold and cannot open an order enquiry. Saving Sold or quantity zero sets quantity to zero and records `sold_at`. Editing an already-sold item preserves its date. Relisting requires Available and a positive quantity, and clears the old sale date. Sending an enquiry does not automatically sell or reserve stock.
- A save only succeeds after the database returns the saved row. Errors remain beside the form; entries and photo selections stay available for correction/retry. The same applies to contact details. Controls are disabled during photo preparation and saving.
- New listings retain the same UUID (unique item identifier) during retries. Completed photo uploads are reused after a failed save. A missing online library cannot silently fall back to demo mode.

Keep the page open after an unsuccessful save and retry without clearing the form. Unsaved entries are held in the open page; they are not a persistent recovery draft and will be lost on reload/closing the tab.

## Database setup and release

The original `SQL - 1.txt` and `SQL - 2.txt` are preserved. They are setup scripts, not data backups. A read-only production setup query was run on 29 October 2026; no database schema or inventory records were changed.

1. The live Supabase project `dmlebylgswtcsfsokxzz` was checked on 29 October 2026. All three extra item columns, the public `item-photos` bucket, and the access policies from `SQL - 2.txt` are present. Row-level security is enabled on both `items` and `settings`, and the required authenticated table grants are present. The database is ready for the updated page; no upgrade is needed.
2. Keep `database-check.sql` for future read-only checks. Do not rerun either original setup script on this project: their `CREATE POLICY` statements are not repeatable. For a new project, apply `SQL - 1.txt` and then `SQL - 2.txt` once.
3. The original access model gives all signed-in users editing rights. Keep only intended administrators in this project's users and retain the existing disabled public signup configuration. This update does not change user accounts or permissions.
4. Publish the updated `index.html` after the database check. The test files, backups, and SQL scripts are not required to serve the page.
5. Run the live acceptance checks below with an authorised administrator. The setup was verified through the owner's signed-in Chrome dashboard because the connected Supabase account could not access this project. Website login, authenticated photo uploads, and production item writes remain untested.

Removed/replaced photos and photos from deleted listings are retained in Storage. Completed uploads from abandoned drafts can also remain there. This avoids deleting photos that a save may already reference after a connection failure. Review references before any later storage cleanup; this update performs no automatic file deletion.

## Verification

Automated regression checks (Node.js built-in test runner; no packages needed):

```text
node --test tests/app.test.cjs
```

The tests execute the actual inline JavaScript with an in-memory browser-document substitute and simulated Supabase responses. They exercise failure preservation, partial uploads, lost responses/retries, repeated clicks, stale success notifications, old/new photos, cover selection/removal, sale timestamps/relisting, zero-row updates, missing schema, contact saves, local storage quota, unavailable online library, validation, and gallery ordering rules. These tests do not establish live database access.

Verification recorded on 28 October 2026: JavaScript syntax passed and all 21 automated checks passed. An isolated browser run confirmed two-photo selection and JPEG preparation, choosing a cover, saving, gallery navigation, retaining entries/photos after invalid input, and Sold status plus disabled ordering after refresh.

On 29 October 2026, the read-only production setup query returned 17 rows confirming the three photo/status columns, public photo bucket, seven expected policies, enabled row-level security for both tables, and table grants. No authenticated upload or production write was performed. The existing single-photo records have not been rewritten.

Isolated browser preview:

```text
node tests/preview-server.cjs
```

Open http://127.0.0.1:43127. This preview removes the online settings and external downloads from the served copy only. Admin uses the existing local demo PIN. It cannot write to Supabase. Stop the preview with Ctrl+C when finished.

Live acceptance checks after the database setup is confirmed:

1. Log in, add a clearly named test item with two photos, and save. Refresh and confirm both photos, cover, price, and quantity persist. Check the gallery as a signed-out buyer.
2. Edit an existing single-photo item, add a photo, and confirm the original is retained.
3. Mark the test item Sold, refresh, and confirm ordering is disabled and the row has a sale date. Relist with quantity one and confirm the sale date clears.
4. Temporarily disconnect the browser from the network and try to save an edit. Confirm there is no Item saved message and the fields/photos remain. Reconnect and retry once, then refresh to confirm there is one listing.
5. Update contact details and verify the footer after refresh.

Local originals are preserved in `backups/`. The local original SHA-256 is `FC9B361DCBAFF6E2EE56BA1F0AEFCE20583471EFB9075EDE9917D39EB14B5395`. The GitHub base file was blob `8002ed1fbf08d00d3957313a1a9119b1ecd4d1d8`; its two header wording corrections are retained.
