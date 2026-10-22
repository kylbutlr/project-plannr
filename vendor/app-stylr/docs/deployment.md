# Reference deployment

The canonical App Stylr Reference is hosted at [kylbutlr.com/app-stylr](https://kylbutlr.com/app-stylr). The [portfolio repository](https://github.com/kylbutlr/portfolio) pins an immutable App Stylr revision and runs `app-stylr-reference` during its build. The Reference source remains in this repository, so the hosted route does not maintain a second copy of the page.

The standalone `app-stylr.netlify.app` project is a legacy mirror. Its generated metadata points search engines and shared links to the canonical portfolio route.

## Legacy mirror configuration

[`netlify.toml`](../netlify.toml) is the deployment source of truth:

- Base directory: `reference`
- Build command: `cd .. && npm ci && npm run site`
- Publish directory: `../.site`

The subdirectory base prevents Netlify from treating the repository's Swift package as a build-time dependency. The build command moves to the repository root, installs the Node dependencies, and prepares a deliberately scoped static artifact.

Netlify documents that the base directory controls where dependency files are detected and where the build runs, and that root `netlify.toml` settings override corresponding UI values. See the official [monorepo configuration](https://docs.netlify.com/build/configure-builds/monorepos/) and [file-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/) documentation.

## Local verification

```sh
npm run site
find .site -maxdepth 2 -type f | sort
```

Only `.site/index.html`, `.site/styles.css`, `.site/app-stylr-reference.json`, `.site/adapters/`, and `.site/assets/` are published. Package documentation, maintenance files, and repository-only tooling remain outside the artifact.

The packaged `app-stylr-reference` command can generate the same versioned artifact below another host. Its output directory, canonical URL, and base path are explicit, so the Reference source remains in this repository while the generated page can be published at a route such as `/app-stylr`.

## Publishing an update to the canonical route

Merging this repository does not automatically change the portfolio's pinned App Stylr revision. After an App Stylr change is released or approved for the public site:

1. update the immutable App Stylr dependency in the portfolio repository;
2. run the portfolio build and accessibility checks;
3. inspect the generated `/app-stylr` route locally;
4. merge the portfolio update through its normal pull-request flow;
5. verify the [live Visual Reference](https://kylbutlr.com/app-stylr), its assets, and canonical metadata.

This deliberate pin prevents an unreviewed App Stylr commit from changing the public portfolio during an unrelated deploy.

On the legacy mirror, the retired `/reference/` and `/reference/style-guide.html` URLs permanently redirect to its root page so existing bookmarks do not break.
