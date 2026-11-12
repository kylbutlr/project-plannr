# Release process

App Stylr consumers pin immutable semantic versions. A release is complete only when the package version, canonical tokens, generated adapters, migration note, Git tag, published package where applicable, and public reference site agree.

## Supported channels

- **GitHub tags:** the source release and the installation channel for Git dependencies.
- **npm:** an optional registry distribution channel for Node, CSS, assets, templates, and commands. GitHub-tag installations include the same package interface without npm publication.
- **Swift Package Manager:** the Swift adapter distribution channel, resolved from the same Git tag.

All channels use the same semantic version. A Git tag alone does not prove npm publication or reference-site deployment, and an npm package does not prove the Swift tag is public.

## Versioned installation

The README, Reference, consumer template, schema ID, and consumer instructions target the `v1.4.1` GitHub tag. These links become usable only when that tag is public. Verify an empty-directory Git install and a clean Swift consumer against the public tag before declaring this channel released. Do not infer npm publication from source version numbers or GitHub tags.

When restoring an existing release after repository-history consolidation, tag the preserved release contents without making removed history reachable again. New releases tag their reviewed merge commit. Consumers pinned to an old commit must migrate to the surviving tag before their next install or build.

## Prepare a release

1. Choose the version from the compatibility impact.
2. Move intended notes into that version’s changelog section.
3. Set the same version in `package.json`, `package-lock.json`, `tokens/app-stylr.json`, consumer templates, and rendered guides.
4. Add a migration note for any changed public interface.
5. Run `npm run build`, `npm run icons`, `npm run chrome-theme`, and `npm run site`.
6. Run `npm test`, `npm run package:check`, and `swift build`.
7. Inspect the packed npm file list and the local Reference page at desktop and phone widths.
8. Verify Git author and committer identity before committing release preparation.

## Publish and verify

Each write requires explicit approval.

1. Merge the reviewed release commit to `main`.
2. Create an annotated `vX.Y.Z` tag at the exact merge commit and push that exact tag.
3. Verify the tag and GitHub release page are public.
4. If using the npm registry channel, publish from the verified tag, then install `app-stylr@X.Y.Z` in a new empty directory and rerun the public example. Record npm as unused when distributing through the GitHub tag instead; do not introduce a registry publication merely to match the source version.
5. Resolve the Swift package from the public tag and build a clean Swift consumer.
6. Update the portfolio's immutable dependency to the published tag and lock it, then follow [Reference deployment](./deployment.md) to validate and deploy the canonical `/app-stylr` route. Verify the version manifest, assets, metadata, and affected responsive states on the public route. Verify the standalone mirror separately.
7. Update the GitHub repository homepage to the canonical Reference URL and confirm the public installation command works from an empty directory.
8. Record each channel separately in the release notes.

Never publish from a dirty worktree, a feature branch, an untagged commit, or a package whose packed contents were not inspected.

## Versioning policy

- Patch: compatible correction or clarification.
- Minor: additive token, adapter, export, template, asset, or command behavior.
- Major: removed or renamed public token, export, command, semantic meaning, or supported compatibility floor.
