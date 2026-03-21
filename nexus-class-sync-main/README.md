# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/8f43adcc-4599-4fc5-bd0e-6af934ba737a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/8f43adcc-4599-4fc5-bd0e-6af934ba737a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Tauri (Desktop App Framework)

## Tauri Desktop App

This application has been configured as a Tauri desktop app. You can run it as a desktop application on Windows, macOS, and Linux.

### Prerequisites

- Node.js & npm (or bun)
- Rust (install from https://rustup.rs/)
- System dependencies:
  - **Windows**: Microsoft Visual C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### Setup Icons

Before building, you need to generate Tauri icons:

```sh
npm run tauri icon path/to/your-icon.png
```

This will generate all required icon formats from a single source image.

### Development

Run the app in development mode:

```sh
npm run tauri:dev
```

This will:
1. Start the Vite dev server
2. Build and run the Tauri desktop app
3. Enable hot-reload for both frontend and backend changes

### Building for Production

Build the desktop app for your platform:

```sh
npm run tauri:build
```

The built application will be in `src-tauri/target/release/bundle/`.

### Web Development (without Tauri)

You can still run the app as a web application:

```sh
npm run dev
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/8f43adcc-4599-4fc5-bd0e-6af934ba737a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
