# Connect your library using Railway

Your website stays at https://reallprogrammer.github.io/ffinal/. Railway will run three resources in one project: the library API, PostgreSQL, and a private storage bucket. No Railway resources have been created for you yet.

Railway's published Hobby price is $5/month including $5 of resource usage; total charges increase if usage exceeds that credit. The API, database, storage, and traffic all contribute to costs. Review your dashboard's pricing and usage controls before deploying. Book downloads pass through the API, so service egress charges apply even where bucket egress is free.

## 1. Create the project and storage

1. Sign in at https://railway.com/ using GitHub. Create an empty project named `personal-library`.
2. Choose **+ New / Create → Database → PostgreSQL**. Keep its persistent volume. Leave database public access disabled.
3. Choose **+ New / Create → Bucket**. Name it `library-books` and choose a region near your audience and API. Railway buckets are private.
4. Open the bucket's **Credentials** tab. You will reference its endpoint, region, actual S3 bucket name, access key ID and secret key from the API. The actual bucket name contains a suffix; the display name alone is not sufficient.

Do not upload books directly to the bucket: the library's owner editor validates uploads and creates their database records.

## 2. Add the API from GitHub

1. In the same project, choose **+ New → GitHub Repo** and select `ReallProgrammer/ffinal`. If it is missing, grant the Railway GitHub app access to this repository.
2. Name this service `library-api`, use branch `main`, and set **Settings → Source → Root Directory** to `/server`.
3. Railway should detect `server/Dockerfile`. Leave custom build and start commands empty; the Dockerfile handles them. Keep one replica.
4. Set the health-check path to `/api/v1/health`.
5. Add the variables below before the final deployment. An initial automatic deployment may fail until configuration is complete; redeploy after adding it.

## 3. Configure the API variables

Open **library-api → Variables**. Use Railway's variable-reference picker for the database and bucket fields. The reference names depend on the names of your resources. For example, with a database named `Postgres`, `DATABASE_URL` can reference `${{Postgres.DATABASE_URL}}`.

| API variable           | Value or source                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`         | PostgreSQL service's private `DATABASE_URL` reference                                                        |
| `S3_BUCKET`            | Bucket's `BUCKET` reference (actual S3 name)                                                                 |
| `S3_ENDPOINT`          | Bucket's `ENDPOINT` reference                                                                                |
| `S3_REGION`            | Bucket's `REGION` reference                                                                                  |
| `S3_ACCESS_KEY_ID`     | Bucket's `ACCESS_KEY_ID` reference                                                                           |
| `S3_SECRET_ACCESS_KEY` | Bucket's `SECRET_ACCESS_KEY` reference                                                                       |
| `S3_FORCE_PATH_STYLE`  | `false` for new virtual-hosted buckets; use `true` only if the bucket's Credentials tab specifies path style |
| `S3_CREATE_BUCKET`     | `false`                                                                                                      |
| `OWNER_EMAIL`          | The email you want to use to sign in                                                                         |
| `OWNER_PASSWORD_HASH`  | Generate below; never use your plaintext password here                                                       |
| `FRONTEND_ORIGINS`     | `https://reallprogrammer.github.io` — no `/ffinal/` and no trailing slash                                    |
| `NODE_ENV`             | `production`                                                                                                 |
| `HOST`                 | `0.0.0.0`                                                                                                    |
| `PORT`                 | `8787`                                                                                                       |
| `TRUST_PROXY_HOPS`     | `0` initially; change only after confirming the trusted proxy topology                                       |

With proxy trust left at zero, sign-in rate limiting conservatively groups requests by the connecting proxy. For this single-owner library that is workable; after ten sign-in attempts in fifteen minutes, wait for the limit to reset. Do not set proxy trust to an arbitrary large number.

Railway's automatic AWS SDK variable preset may use different names. This application needs the exact variable names in the table. Use references rather than copying credentials into source files. Credentials belong only in the backend Variables panel, never GitHub Pages variables or chat.

## 4. Generate your owner password hash

On your computer, install Node.js 24 from https://nodejs.org/ if needed. Download the repository with **GitHub → Code → Download ZIP**, extract it, and open a terminal in the extracted `ffinal-main` folder. The hash helper uses built-in Node modules, so this step needs no `npm install`.

Choose a unique password of at least 14 characters. Save the password in your password manager. The commands below hide your input and print only a salted hash starting with `scrypt:`.

**Windows PowerShell:**

```powershell
$libraryPassword = Read-Host 'Choose your library password (14+ characters)' -AsSecureString
[System.Net.NetworkCredential]::new('', $libraryPassword).Password | node server/src/password.mjs
Remove-Variable libraryPassword
```

**macOS or Linux, using Bash:**

```bash
bash
read -r -s -p 'Choose your library password (14+ characters): ' library_password
printf '\n'
printf '%s' "$library_password" | node server/src/password.mjs
unset library_password
```

Copy the complete `scrypt:...` output into Railway's `OWNER_PASSWORD_HASH` variable. Do not paste it in this chat. Your eventual login uses the original password, not this hash.

## 5. Deploy and verify the API

1. Deploy the staged Railway changes. Logs should reach `Library API listening on 0.0.0.0:8787`.
2. Open **library-api → Settings → Networking → Public Networking → Generate Domain**. Use target port `8787` if asked.
3. Visit `https://YOUR-RAILWAY-DOMAIN/api/v1/health`. It must show `{"status":"ok"}`.

If deployment fails, inspect the first error: `Missing ...` identifies an absent variable; a database connection failure points to the private database reference; `Storage bucket is unavailable` points to the bucket name, credentials, endpoint or URL style. Share the error text with secrets removed if you need help. Do not disable TLS verification.

## 6. Connect GitHub Pages

1. Open https://github.com/ReallProgrammer/ffinal/settings/variables/actions.
2. Under **Variables**, create a repository variable named `LIBRARY_API_URL`.
3. Its value must be `https://YOUR-RAILWAY-DOMAIN/api/v1` (include `/api/v1`, without a trailing slash).
4. Open **Actions → Deploy portfolio to GitHub Pages → Run workflow**, select `main`, and run it. Wait for both build and deploy to succeed.
5. Reload https://reallprogrammer.github.io/ffinal/ and open **My Shelf → Owner access**. The setup explanation should now be replaced by the real sign-in form.

This URL is public configuration. Do not put a database URL, password or bucket credentials in GitHub Pages variables. The website must be rebuilt when its API URL changes.

## 7. Upload and publish your first book

1. Sign in with your `OWNER_EMAIL` and original password.
2. Create a shelf and choose **Add book**.
3. Enter the title, author and other metadata; choose its shelf.
4. Upload a front cover (PNG/JPEG/WebP, up to 10 MB). Separate spine and back artwork are optional.
5. Upload the PDF or EPUB (up to 50 MB). Adjust dimensions and color, then inspect the 3D preview.
6. Choose whether visitors may read/download the digital file. Leaving this private still lets visitors see the published book's cover and details.
7. Save as published, then sign out. Confirm that the book appears, can be inspected, and opens if you allowed public reading.
8. Reload or use a private browser window to confirm persistence and visitor access.

Future uploads happen entirely through **My Shelf → Owner access**. They do not require a website redeployment.

Enable scheduled backups for the PostgreSQL volume. Railway's current bucket documentation says automatic bucket backups are unavailable, so retain a separate copy of original covers and books.

## Provider references

Instructions checked against Railway's official documentation source on October 9, 2026:

- [Buckets, credentials and URL style](https://docs.railway.com/storage-buckets)
- [PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Repository root directories](https://docs.railway.com/deployments/monorepo)
- [Dockerfile deployment](https://docs.railway.com/builds/dockerfiles)
- [Pricing](https://docs.railway.com/pricing/plans)
