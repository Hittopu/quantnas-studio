# Google Apps Script channel

This directory contains the Google Sheets and Gmail backend for QuantNAS Studio.

## Deployment

1. Create a new Google Sheet named `QuantNAS Studio Requests`.
2. Open `Extensions -> Apps Script` from the Sheet.
3. Replace the editor contents with `Code.gs` from this directory.
4. Open project settings, enable showing `appsscript.json`, and replace it with the manifest in this directory.
5. Run `setupQuantNasChannel` once and approve the requested Sheets and email permissions.
6. Review the generated `Config` sheet. Set `ADMIN_EMAILS`, `REPLY_TO`, and `SITE_URL`.
7. Choose `Deploy -> New deployment -> Web app`.
8. Set `Execute as` to yourself and `Who has access` to `Anyone`.
9. Copy the `/exec` URL into `src/config.js` as `appsScriptWebAppUrl`.

## Result delivery

1. Locate the request row in the `Requests` sheet.
2. Paste a valid JSON document into `result_json`.
3. Optionally edit `result_file_name`.
4. Set `status` to `READY`.
5. Select the row and use `QuantNAS -> Send selected result`, or use `Send all READY results`.
6. Successful delivery changes the status to `SENT` and fills `result_sent_at`.

Do not publish or share the Requests sheet. It contains user email addresses and task descriptions.
