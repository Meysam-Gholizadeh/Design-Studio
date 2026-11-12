# Publishing Power BI files to the gallery
## BI Design Studio · Admin page (`/admin`)

Scope change (2026-11-12, requested by the user): the site owner can publish Power BI reports (`.pbix`) and custom visuals (`.pbiviz`) to the gallery. Decisions agreed with the user:
- **Storage: files in the repository.** There is still no server or database.
- **Protection: Cloudflare Access** in front of the admin page.

## How it works

1. **Open the page.** The owner opens `https://<site>/admin`. Nothing links to it.
2. **Connect GitHub.** The owner enters the repository and a GitHub token, and the page checks that the token may write to the repository.
3. **Choose and check the file.** The owner chooses a file, and the page checks it in the browser:
   - **`.pbix`:** must be a zip package containing `[Content_Types].xml` and a `Report/` folder.
   - **`.pbiviz`:** must be a zip package with a `package.json` that has a visual GUID. The display name, description, version and author are read from it to fill in the form.
   - **Size:** at most 25 MB, the most Cloudflare serves as a single file.
   - **Preview picture (optional):** PNG, JPEG or WebP, at most 2 MB.
4. **Publish.** One commit goes to the branch through the GitHub Git Data API (blobs, then a tree, a commit and a branch update with no force):
   - `public/published/<id>/<file name>`
   - `public/published/<id>/preview.<ext>`
   - `public/published/manifest.json`, the gallery list, validated by `src/domain/schemas/published.ts`.

   If someone else pushed to the branch meanwhile, nothing changes and the page asks you to try again.
5. **Redeploy.** Cloudflare redeploys from the new commit, provided the project builds from GitHub automatically. The gallery then fetches `/published/manifest.json` and shows a **"Power BI files"** section. It uses the same search and category filter as the templates, and each card has a download link.
6. **Remove.** Removing an item is also one commit, which deletes the files and the list entry. Git history keeps old files.

Code:
- `src/services/published/`: file checks, manifest, GitHub publisher, token storage, gallery loading.
- `src/components/admin/` and `src/pages/AdminPage.tsx`.
- `src/components/gallery/PublishedCard.tsx` and `PublishedSection.tsx`.

## Download switch for custom visuals (2026-11-12, user request)

A custom visual can be shown in the gallery **with or without** a download button. You set this with the "Allow visitors to download" switch when publishing, and can change it later from the switch on the item's row in the published list. Reports (`.pbix`) are always downloadable.

- **Download on:** the file is in `public/published/<id>/`, so the site serves it, and the card has a download button.
- **Download off:** the file is moved to `gallery-held/published/<id>/`, which is outside `public/`, so the site never serves it, even if someone knows the address. The card says "Shown for reference; download is not offered".
- **Each change is one commit.** It points the new path at the same git blob and deletes the old path, so nothing is uploaded again.
- **Stored in the list:** the setting is the item's `downloadable` field in `manifest.json`. Lists written before this setting existed count as "on".
- **Repository visibility:** if the GitHub repository is **public**, a held file can still be downloaded from GitHub itself. Make the repository private if that matters. Turning the download off also does not recall copies people already downloaded.

## One-time setup

### 1. GitHub token

Create a token at GitHub → Settings → Developer settings → **Fine-grained tokens**, with these settings:
- **Repository access:** only `Meysam-Gholizadeh/Design-Studio`.
- **Permissions:** Contents, Read and write. Metadata, read-only, is added automatically.
- **Expiry:** whatever you prefer. When it expires, create a new one and enter it again.

The token is kept in your browser only: in this tab's session, or in local storage if you tick "Remember". It is sent only to `api.github.com`. **The token is the real lock.** The admin page's code is part of the public site bundle, but without a token that can write to the repository, nobody can publish or remove anything.

### 2. Cloudflare Access (protects the page itself)

In the Cloudflare dashboard, go to **Zero Trust → Access → Applications → Add an application → Self-hosted**:
- **Domain:** the site's hostname, with the path `admin`.
- **Policy:** Allow, with an Include rule of *Emails*: your email address.
- **Login method:** one-time PIN, or any identity provider you prefer.

On a `*.workers.dev` hostname, Cloudflare may only offer to protect the **whole** Worker (Worker → Settings → Domains & Routes → workers.dev → *Enable Cloudflare Access*). To protect only `/admin`, give the site a custom domain and create the application on that domain. These dashboard steps were not tried from here; the Cloudflare dashboard is the authority.

## Limits and notes

- **Delay:** files appear after the next deploy, usually a few minutes. The admin list reads the branch directly, so it can show files that are not live yet.
- **Repository size:** every published file stays in git history, so the repository grows by each file's size. Keep reports small (for example, use sample data).
- **Public downloads:** anyone can download published files. Remove confidential data before publishing.
- **Previews:** `.pbix` files are not rendered by the studio, because they are binary Power BI files and not design documents. The gallery shows your preview picture, or an icon if there is none.
- **Tests:**
  - Unit tests in `tests/unit/services/published.test.ts` cover the file checks, the manifest, building an item, and the GitHub publisher's commit sequence, conflicts and errors, using a fake fetch.
  - End-to-end tests in `tests/e2e/admin-publish.spec.ts` cover the admin flow against a fake GitHub API, and the gallery section.
  - Not yet tried: publishing against the real GitHub repository and seeing a Cloudflare redeploy.
