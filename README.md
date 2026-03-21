# BlueSync Student

Desktop student portal (Tauri + React). Application code lives in [`nexus-class-sync-main/`](./nexus-class-sync-main/).

## First-time push (from this folder)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Utilitas-Systems/BlueSyncstudent.git
git push -u origin main
```

## CI builds

GitHub Actions workflow: [`.github/workflows/build.yml`](./.github/workflows/build.yml). After pushing to `main`, open **Actions** to see builds. In **Settings → Actions → General**, set workflow permissions to **Read and write** so releases can be created.
