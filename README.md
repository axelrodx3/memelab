# MemeLab

The internet's meme studio.

MemeLab is a fast, watermark-free workspace for discovering meme templates,
remixing them, and exporting finished images. The product includes:

- A locally hosted, curated template catalog with visual duplicate prevention
- Searchable aliases, categories, tags, detail pages, and related templates
- A live canvas editor with captions, character/logo overlays, and PNG export
- Private account-synced projects with autosave, rename, duplicate, and delete
- Device-only drafts and local favorites for creators who are not signed in
- A community feed with posts, votes, comments, profiles, and moderation tools

Supabase powers authentication, private projects, storage, and community data.
Vercel builds and deploys production from the GitHub `main` branch.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production

```bash
npm run build
npm start
```
