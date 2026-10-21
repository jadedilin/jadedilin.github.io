# Personal website | Jade Lin

This is <a href="https://jadedilin.github.io">my website</a>, built with <a href="https://jekyllrb.com/">Jekyll</a>. 

This site documents my ongoing code projects and professional journey. It launched just ahead of RailsConf 2025.

## How it deploys

- GitHub Pages builds from the **`gh-pages`** branch, **`/docs`** folder. `gh-pages` is the default branch.
- Pushing to `gh-pages` rebuilds the live site automatically, usually within a minute or two.
- Only files inside `docs/` are published. The `index.html` at the repo root is not served.
- Check build status under the repo's **Actions** tab (`pages-build-deployment`), or with:

  ```sh
  gh api repos/jadedilin/jadedilin.github.io/pages/builds/latest --jq .status
  ```

## Where things live

| Path | What it is |
|---|---|
| `docs/_config.yml` | Site title, description, social links, theme (`minima`) |
| `docs/index.md`, `about.md`, `contact.md` | Top-level pages |
| `docs/_posts/` | Published posts (`YYYY-MM-DD-title.md`) |
| `docs/_drafts/` | Unpublished drafts, not built on the live site |
| `docs/_layouts/`, `docs/_includes/` | Overrides of the minima theme's templates |
| `docs/portal/` | The hidden 8-bit portal (plain JS modules, no build step) |

## The portal

A small unlabelled swirl button sits at the bottom centre of the **homepage only**. Clicking it opens an 8-bit dream catcher scene.

- It's wired up in `docs/_layouts/default.html`, inside `{% if page.layout == "home" %}`.
- The button must stay **outside** `<main>`: the portal ripples `<main id="page">` with an SVG filter, which would distort the button and break its fixed positioning.
- `button.js` draws the swirl and lazy-loads `portal.js` (and the rest of the scene) on hover, focus or idle.

## Running locally

```sh
cd docs
bundle install
bundle exec jekyll serve   # http://localhost:4000
```

Drafts can be previewed with `bundle exec jekyll serve --drafts`. `_site/` and `Gemfile.lock` are git-ignored.
