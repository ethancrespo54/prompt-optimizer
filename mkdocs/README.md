# Documentation Development and Preview (Conda Edition)

This project lives in the `mkdocs/` subdirectory at the repository root and is completely independent of the application project.

## Prerequisites

- Conda installed (Miniconda or Anaconda, latest version recommended)

## Create and Activate a Conda Environment (Named After the Project)

Run inside the `mkdocs/` directory:

```bash
conda create -n prompt-optimizer-docs python=3.11 pip -y
conda activate prompt-optimizer-docs
```

> To leave the environment: `conda deactivate`

## Install Dependencies

```bash
python -m pip install -r requirements.txt
```

## Local Preview

Several configuration files are provided to suit different needs:

### Fast Development Mode (recommended for everyday use)

```bash
mkdocs serve -f mkdocs-dev.yml
```

- **Startup time**: about 0.25 seconds (very fast)
- **Features**: time-consuming plugins (such as mermaid2) are removed, basic i18n support is kept, and the focus is on writing docs
- **Use cases**: everyday development, quick previews, writing documentation

### Full-Featured Mode

```bash
mkdocs serve -f mkdocs.yml
```

- **Startup time**: slower on the first run (the mermaid library needs to be downloaded); much faster afterwards
- **Features**: includes everything (diagram rendering, i18n support, etc.)
- **Use cases**: full-featured preview and production builds

### Configuration Files

- **`mkdocs-dev.yml`** - Fast development mode with all time-consuming features removed
- **`mkdocs.yml`** - Full-featured version with all plugins

The site is served at `http://127.0.0.1:8000/` by default.
To preview together with the "version switcher", use:

```bash
mike serve -F mkdocs.yml
```

## Strict Build Validation

```bash
mkdocs build --strict -f mkdocs.yml
```

`--strict` treats link/reference problems as errors, so issues are caught early, before committing.

## Versions and Tags (mike)

This project uses `mike` to manage multiple versions (natively supported by Material). Run the common commands inside the `mkdocs/` directory:

```bash
# Publish a version for the first time, and create/update the alias latest at the same time
mike deploy -F mkdocs.yml 0.1 latest

# Set the default version to latest (it is preferred when the root path is visited)
mike set-default -F mkdocs.yml latest

# List the published versions
mike list -F mkdocs.yml

# Preview the multi-version site locally (based on the content published to the branch)
mike serve -F mkdocs.yml
```

It is recommended to use a dedicated branch for the documentation output (for example `vercel-docs`) so Vercel can host that branch directly:

```bash
mike deploy --branch vercel-docs --push -F mkdocs.yml 0.1 latest
mike set-default --branch vercel-docs --push -F mkdocs.yml latest
```

> Note: when i18n is combined with mike, URLs are usually `/<version>/<lang>/...`, such as `/latest/en/`.

## FAQ

- Version list not shown: make sure at least one version has been published with `mike deploy`, and that a default version has been set with `mike set-default`.
- `mike` command not available: make sure the dependencies are installed in the current Conda environment, or try running it as `python -m mike`.

## Clean Up the Environment (Optional)

Remove the environment completely:

```bash
conda deactivate
conda remove -n prompt-optimizer-docs --all -y
```
