# YouTube API Services — Audit and Quota Extension Draft

Use this document as the basis for the YouTube API Services Audit and Quota Extension Form. Replace bracketed fields with the legal details of the applicant before submission.

## Applicant and client

- **API client name:** YouTube Meta Exporter
- **Public URL:** https://dpanarin35-sys.github.io/youtube-meta-export/
- **Privacy Policy:** https://dpanarin35-sys.github.io/youtube-meta-export/privacy.html
- **Terms of Use:** https://dpanarin35-sys.github.io/youtube-meta-export/terms.html
- **Developer / legal entity:** [replace with legal name or company]
- **Contact email:** dpanarin35@gmail.com
- **Requested quota:** 250,000 units per day

## Product description

YouTube Meta Exporter is a browser-based tool for channel owners. A user signs in with Google OAuth, sees the videos belonging to the YouTube channel associated with that Google account, selects one or more videos, and downloads the selected metadata as JSON or CSV.

The product's independent value is a structured, user-controlled export of the channel owner's own metadata, statistics, status information, and — only when the user explicitly enables the option — caption-track metadata and caption text. It does not play, download, modify, publish, delete, or otherwise manage YouTube videos.

## Why the requested OAuth scope is needed

The application requests `https://www.googleapis.com/auth/youtube.force-ssl`. This scope is required by the YouTube Data API caption endpoints used to list caption tracks and download caption text for the authenticated channel owner's videos. The application makes no write calls and contains no UI that can change YouTube resources.

## Data handling and privacy

- OAuth is completed through Google; the application never collects Google passwords.
- OAuth access tokens remain only in browser memory for the active session.
- The static site and its hosting do not store YouTube API data, OAuth tokens, or exported files.
- The user chooses when to download JSON/CSV; the resulting file is saved only on that user's device.
- The application does not sell, share, profile, track, or provide authorized YouTube data to third parties.
- The user can use the in-product "Revoke access and delete data" action, revoke access in Google Account permissions, and delete locally downloaded files.

## API methods and daily quota estimate

| API method | Purpose | Estimated cost |
| --- | --- | ---: |
| `channels.list` | Identify the authenticated user's channel | 1 unit per request |
| `playlistItems.list` | Enumerate the uploads playlist | 1 unit per page |
| `videos.list` | Retrieve selected video metadata | 1 unit per request, up to 50 IDs |
| `captions.list` | Find caption tracks for each selected video | 50 units per video |
| `captions.download` | Download text for a selected caption track | 200 units per track |

The intended one-time export covers a channel with 771 videos. With one caption track per video, caption operations require approximately 192,750 quota units (771 × 50 + 771 × 200), plus a small number of metadata requests. A 250,000-unit daily allocation provides a reasonable buffer for videos with additional tracks and retries.

## Evidence to upload to the form

1. `homepage-policy-links.png` — homepage showing the visible Privacy Policy and Terms links.
2. `privacy-policy.png` — Privacy Policy, including data handling, deletion, Google Privacy Policy link, and contact email.
3. `terms-of-use.png` — Terms of Use, including the YouTube Terms link.
4. `oauth-login.png` — Google OAuth flow initiated from the application.
5. `oauth-consent.png` — Google permission screen after account selection, showing the requested access.
6. `export-caption-option.png` — selected videos and the unchecked "Include caption text" option.
7. `revoke-access.png` — signed-in view with the "Revoke access and delete data" action.
8. `architecture.svg` — technical data-flow diagram included in this directory.

Do not upload a screenshot containing OAuth tokens, Client Secret values, video private information, or local file paths.
