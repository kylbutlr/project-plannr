# Public README guidelines

A public README should help three audiences in order: a visitor deciding whether the product is relevant, a user trying it for the first time, and a contributor verifying or changing it. Keep the first screen concise, then add detail in a predictable sequence.

These guidelines are a content standard, not a claim that every product has the same features or release process. Omit sections that genuinely do not apply, and add product-specific sections where they improve understanding.

## Recommended information sequence

1. **Name and promise**
   - Start with one H1 containing the product name.
   - Follow it with one sentence describing the user, problem, and primary outcome.
   - Add one short paragraph for the product model or defining boundary.
   - Link the canonical product page, demo, or visual reference when one exists.
2. **Status**
   - State the current version or release channel.
   - Distinguish public source, local installation, beta availability, package publication, and store publication.
   - Name material readiness gaps without turning the README into a roadmap.
3. **Highlights** or **What it provides**
   - Use a compact list of concrete capabilities.
   - Describe observable behavior, not aspirations or broad marketing claims.
4. **Quick start**
   - Put the shortest safe path to a useful result first.
   - Include prerequisites, installation, and the first successful workflow.
   - Keep commands copyable and verify them from a clean checkout.
5. **How it works**
   - Add only when users need a mental model beyond the quick start.
   - Prefer product vocabulary and visible rules over implementation internals.
6. **Privacy and permissions**
   - Explain where data lives, when network requests occur, and what leaves the device.
   - For browser extensions, list every required and optional permission with its user-facing purpose.
   - Link the complete privacy or permission document when one exists.
7. **Known limitations**
   - Identify meaningful unsupported surfaces, environmental constraints, and failure boundaries.
   - Keep future ideas and speculative roadmap items elsewhere.
8. **Development**
   - List the minimum supported runtime and the authoritative install, test, build, and package commands.
   - State where generated artifacts go and whether packaging publishes anything.
9. **App Stylr**
   - Name the pinned App Stylr release when the product claims compatibility.
   - Link the Visual Reference and the product's documented exceptions.
   - Do not imply that the live reference replaces a pinned dependency.
10. **Support**
    - Link a working public issue tracker or support destination.
    - Tell reporters not to include credentials, private URLs, or confidential captures.
11. **License**
    - Name and link the repository's actual license.

Adapt this sequence to the product and its audience. Libraries and shared foundations often need installation, exports, commands, and compatibility before feature detail. The outcome matters more than matching a template: a new visitor should understand the value, current availability, safe first step, data handling, limitations, and support path without hunting.

## Writing rules

- Write for someone who has not seen the project before.
- Use the product name consistently and explain product-specific terms before relying on them.
- Prefer direct verbs such as “captures,” “compares,” and “organizes.”
- Separate current behavior from planned work. Use “not published” or “not supported” when that is the verified state.
- Separate source availability from product distribution. A public repository is not the same as a store listing, hosted service, or package release.
- Keep private repository names, local checkout paths, credentials, user data, and internal rollout notes out of public documentation.
- Avoid badges unless their destination is public, stable, and useful to a visitor.
- Use relative links for repository files and descriptive labels for external destinations.
- Keep command comments outside copyable command blocks when possible.
- Do not duplicate a long policy in the README. Summarize the decision and link the authoritative document.

## Verification checklist

Before publishing a README update:

- Confirm every version, browser requirement, release status, and support destination.
- Run each documented setup, test, build, and package command that changed.
- Verify every relative link and the most important external links.
- Compare permissions and privacy claims with the current manifest and implementation.
- Confirm generated artifacts and release commands are described without implying publication.
- Search for private paths, credentials, private product names, stale visibility language, and internal-only instructions.
- Preview the rendered Markdown at desktop and narrow widths when tables or dense lists changed.

Start new product documentation from the [public product README template](../templates/public-product-readme.md), then remove placeholders and sections that do not apply.
