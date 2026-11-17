# macOS Sparkle release guidance

App Stylr includes an optional command for validating a prepared Sparkle release. It does not build, sign, upload, deploy, or publish a macOS application.

This guide separates the release invariants that every Sparkle consumer must satisfy from an opinionated automation profile that teams may adopt. Native platform conventions and the application’s own security requirements remain authoritative.

## Required release invariants

A source push is not a Sparkle release. An update is available only after all of these exist together:

1. The application bundle has a semantic version and a higher comparable build number.
2. The archive contains the intended application and a persistent code signature. Do not use ad hoc signing for a release.
3. A Sparkle-signed `appcast.xml` advertises that exact version, build, archive URL, and signature.
4. The archive and appcast are published together.
5. The public feed advertises the new version and both public URLs return HTTP `200` before **Check for Updates…** is tested.

If any invariant is missing, the installed application may correctly report that it is up to date. Repair the release artifact and appcast together. Do not change the public key to work around a publication failure.

The App Stylr checker validates local metadata and artifacts before publication:

```sh
npx app-stylr-macos-release-check \
  --info-plist apps/macos/Resources/Info.plist \
  --appcast public/updates/appcast.xml \
  --archive public/updates/Example-App-1.2.3.zip
```

The command does not prove that a public feed was deployed or that the installed application can retrieve it. Public verification remains a separate release gate.

## Required Info.plist contract

The release bundle must include values equivalent to:

```xml
<key>CFBundleShortVersionString</key>
<string>1.2.3</string>
<key>CFBundleVersion</key>
<string>1002003</string>
<key>SUFeedURL</key>
<string>https://updates.example.com/appcast.xml</string>
<key>SUPublicEDKey</key>
<string>PUBLIC_KEY_FROM_GENERATE_KEYS</string>
<key>SURequireSignedFeed</key>
<true/>
```

App Stylr’s checker expects the comparable build form `major * 1,000,000 + minor * 1,000 + patch`. A consumer using another monotonic scheme should use its own validator or transform the metadata before adopting this command.

## Signing boundaries

Use a separate Sparkle Ed25519 key for each application. Put only the public key in `Info.plist`. Never commit the Sparkle private key, a certificate password, or an exported signing identity.

Local and hosted builds have different trust boundaries:

- A local build may use a persistent Keychain code-signing identity and should verify the completed bundle with `codesign --verify --deep --strict`.
- Hosted CI cannot rely on a developer’s Keychain. Store the application’s `.p12`, its password, and its Sparkle private key as encrypted repository secrets scoped to that consumer.
- Decode temporary signing inputs into permission-restricted files under the runner’s temporary directory and remove them through the runner’s normal cleanup lifecycle.
- Prefer a signer that can consume the `.p12` directly. Do not make a hosted release depend on changing the runner’s default Keychain or trust database.
- Pin every downloaded signing tool by version and published checksum. Verify the checksum before execution and review the complete signed bundle after upgrades.

For tools such as `rcodesign`, obtain the current binary and checksum from that tool’s official release. App Stylr deliberately does not pin a third-party signer version because signer upgrades and runner compatibility belong to the consuming application’s release workflow.

Pass the Sparkle private key to `generate_appcast` through standard input or another non-logging secret channel. Fail before changing source metadata or public artifacts when any required secret or signing input is missing.

## First-time local setup

Pin a reviewed Sparkle version in the consumer’s `Package.swift`, resolve it, and create the application-specific update key once:

```sh
swift package resolve
.build/artifacts/sparkle/Sparkle/bin/generate_keys \
  --account com.example.your-app
```

Put the printed public key in `Info.plist`. Keep the private key in the local Keychain unless a deliberately configured CI release workflow stores it as an encrypted repository secret.

Verify the local code-signing identity before building:

```sh
security find-identity -v -p codesigning
```

## Repeatable release sequence

1. Update `CFBundleShortVersionString` and its comparable `CFBundleVersion`.
2. Build and persistently sign the complete `.app`.
3. Verify the signature using the verifier appropriate to the selected signing method.
4. Zip the `.app` with the application’s versioned archive name.
5. Generate `appcast.xml` with the application-specific Sparkle key.
6. Run `app-stylr-macos-release-check` against the exact source `Info.plist`, appcast, and archive.
7. Commit the versioned source metadata, archive, and appcast together if the consumer intentionally versions release artifacts.
8. Publish the archive and appcast to the verified production destination.
9. Fetch the public feed and archive, verify the new version and HTTP status, then test **Check for Updates…**.

For example:

```sh
curl -fsSL https://updates.example.com/appcast.xml \
  | grep -E 'sparkle:shortVersionString|sparkle:version'
curl -fsSI https://updates.example.com/Example-App-1.2.3.zip
```

The release process must stop if the signing identity, Sparkle private key, signed archive, appcast, deployment target, or public verification is unavailable. Do not publish only the source changes and describe that as a native release.

## Optional GitHub Actions and Netlify profile

A consumer may automate the sequence with GitHub Actions and Netlify. This is an App Stylr recommendation, not a compatibility requirement.

A robust workflow should:

1. Run only from the consumer’s verified production branch or an explicitly approved manual release event.
2. Use a runner whose installed Swift version satisfies the consumer’s `swift-tools-version`, with an early `swift --version` check.
3. Read Netlify credentials, the `.p12`, certificate password, and Sparkle private key from encrypted consumer-repository secrets.
4. Sign directly from the decoded `.p12` with a pinned, checksum-verified signer instead of mutating the hosted runner’s Keychain trust state.
5. Verify the main executable and nested bundle signatures before archiving.
6. Generate and validate the archive and appcast as one release set.
7. Deploy the exact production site explicitly, wait for completion, and verify the public feed and archive.

Netlify hosts artifacts but does not create or sign them. Its source directory may be `updates` for a dedicated update site or `public/updates` in a larger site. Document the consumer’s exact production site, feed URL, archive path, workflow triggers, secret names, and release ownership in that consumer repository. Those values are private app-family governance and do not belong in App Stylr.

## Troubleshooting

When Sparkle says an application is up to date unexpectedly, check these in order:

- the installed `CFBundleShortVersionString` and `CFBundleVersion`;
- the public `appcast.xml`, not only the local file;
- the appcast build number compared with the installed build number;
- the public archive URL and HTTP status;
- the archive signature and signed-feed metadata;
- the production deployment status and destination;
- CI logs for a signing step blocked on Keychain or trust mutation.

If hosted signing stalls on a `security` command, keep local Keychain signing separate and use a direct `.p12` signing path in CI. Never reuse another application’s Sparkle private key.
