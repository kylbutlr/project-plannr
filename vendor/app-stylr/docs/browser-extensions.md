# Browser-extension adoption

Browser extensions use the same App Stylr interface, but icon and font delivery differ between extension pages and interfaces injected into another site.

## Extension icons

Generate the Chrome icon set from the extension's square product master:

```sh
npx app-stylr-icons --source assets/app-icon.svg --output icons
```

Keep the generated `icons/chrome/` directory intact, then merge [`chrome-extension-icons.json`](../templates/chrome-extension-icons.json) into `manifest.json`. Chrome uses the 16px and 32px files for toolbar density, 48px on the extension management page, and 128px during installation and in the Chrome Web Store. Chrome does not support SVG files in manifest icon declarations.

Inspect the 16px export before shipping. A product symbol that is unclear at that size should be simplified in the master artwork. Keep the App Stylr gradient and silhouette consistent with the larger app icon.

See the complete [platform icon export guide](./platform-icons.md) and Chrome's official [extension icon configuration](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons).

Copy the following files from the pinned App Stylr release into the extension package:

- [`Geist-Variable.woff2`](../assets/fonts/Geist-Variable.woff2)
- [`GeistMono-Variable.woff2`](../assets/fonts/GeistMono-Variable.woff2)
- [`LICENSE-GEIST.txt`](../assets/fonts/LICENSE-GEIST.txt)

## Extension pages

Popup, options, and full-tab extension pages can load the bundled fonts with normal CSS. Keep the paths relative to the extension package:

```css
@font-face {
  font-family: "Geist Sans";
  src: url("fonts/Geist-Variable.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
```

Define Geist Mono the same way, then use the App Stylr semantic font variables and tokens.

## Injected Shadow DOM

A content script can load the packaged fonts through the `FontFace` interface before applying App Stylr styles inside its Shadow DOM:

```js
const fontSansUrl = chrome.runtime.getURL("fonts/Geist-Variable.woff2");
const fontMonoUrl = chrome.runtime.getURL("fonts/GeistMono-Variable.woff2");
const fontFaces = [
  new FontFace("Geist Sans", `url("${fontSansUrl}")`, {weight: "100 900"}),
  new FontFace("Geist Mono", `url("${fontMonoUrl}")`, {weight: "100 900"}),
];

for (const fontFace of fontFaces) {
  document.fonts.add(fontFace);
  fontFace.load().catch(() => {});
}
```

Expose only those packaged font files to the sites where the content script runs:

```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "fonts/Geist-Variable.woff2",
        "fonts/GeistMono-Variable.woff2"
      ],
      "matches": ["https://example.com/*"]
    }
  ]
}
```

Replace the example match with the extension's actual, narrow host scope.

## Host-native controls

An injected control may need to match the host application's typography, density, or colors instead of App Stylr. Treat that as a product requirement and record it in `docs/app-stylr-exceptions.md`. Keep standalone extension surfaces on App Stylr unless they have their own documented exception.
