# HaechiNuri

A lightweight, component-based static site framework with built-in i18n, theming, and an admin dashboard. Zero dependencies beyond Node.js.

## Features

- **Multi-language support** — define content in JSON, one file per language
- **Component-based pages** — compose pages from reusable components (hero, card-grid, text-block, etc.)
- **Theming** — CSS custom properties with automatic dark mode
- **Admin dashboard** — edit content, config, theme, and assets from the browser
- **Multi-site** — run multiple sites from a single installation
- **Docker-ready** — deploy with Docker or docker-compose

## Quick Start

```bash
# Clone the repo
git clone https://github.com/swparkaust/haechinuri.git
cd haechinuri

# Run the example site in development mode
npm run dev -- example

# Open http://localhost:3000
```

## Project Structure

```
haechinuri/
  bin/cli.js          # CLI entry point (build, dev, serve)
  core/               # Builder, server, renderer, i18n
  components/         # Built-in UI components
  admin/              # Admin dashboard UI
sites/
  example/            # Example site
    config.json       # Site configuration (pages, navigation, projects)
    theme.css         # CSS custom properties for theming
    content/          # Localized content (en.json, es.json, ...)
    assets/           # Static files (images, etc.)
    pages/            # Custom site-specific components
```

## Creating a Site

1. Create a new directory under `sites/`:

```bash
mkdir -p sites/mysite/content sites/mysite/assets sites/mysite/pages
```

2. Copy and edit the example config:

```bash
cp sites/example/config.json sites/mysite/config.json
cp sites/example/theme.css sites/mysite/theme.css
cp sites/example/content/en.json sites/mysite/content/en.json
```

3. Run your site:

```bash
npm run dev -- mysite
```

## Commands

```bash
npm run dev -- <site>      # Development server with live reload
npm run build -- <site>    # Build static files to dist/
npm run serve -- <site>    # Production server
```

## Docker

```bash
# Build and run
docker build --build-arg SITE_NAME=example -t haechinuri .
docker run -p 3000:3000 -e ADMIN_PASSWORD=secret haechinuri

# Or use docker-compose
docker compose up
```

## Admin Dashboard

Access the admin dashboard at `/admin` after starting the server. Set the password via the `ADMIN_PASSWORD` environment variable.

From the dashboard you can:
- Edit site configuration and page structure
- Manage localized content for each language
- Upload and manage assets
- Customize the theme
- Preview changes before publishing

## Components

Built-in components that can be used in page sections:

| Component | Description |
|-----------|-------------|
| `hero` | Hero section with title, subtitle, and optional image |
| `feature-banner` | Featured project cards with gradient backgrounds |
| `card-grid` | Grid of cards with tags and links |
| `detail-page` | Project detail page with tech stack and sections |
| `text-block` | Text content with optional image |
| `contact-section` | Contact links with icons |
| `image-gallery` | Image gallery (supports `fit: "contain"` for full-height images) |
| `embed-section` | Embedded content |
| `nav` | Navigation header (auto-included) |
| `footer` | Footer (auto-included) |

## Contributing

Pull requests are welcome. This repo is synced from a private source — accepted contributions are applied there and synced back on the next push. Your PR history and attribution are preserved in the commit.

## License

MIT
