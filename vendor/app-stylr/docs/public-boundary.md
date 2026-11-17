# Public and private boundaries

App Stylr’s public seam is the versioned design foundation that an unrelated developer can install and use without access to any other repository.

## Public product

- canonical semantic tokens and schemas;
- generated CSS and Swift adapters;
- bundled font and reusable icon assets;
- public templates and examples;
- icon, Chrome-theme, and macOS release-check commands;
- visual, compatibility, migration, and release guidance;
- the scoped static reference site.

## Private governance

The following concerns belong in a separate private repository or private automation layer:

- application-family membership and catalog order;
- consumer repository inventories and local checkout paths;
- per-application verification commands and rollout state;
- unpublished product names and metadata;
- deployment targets, credentials, signing identities, and release ownership;
- automation that reads or changes multiple consumer repositories.

The private governance layer may consume a pinned App Stylr release. App Stylr must never depend on that layer, import its registries, or require a sibling checkout. This one-way dependency keeps installation portable and makes the package interface independently testable.
