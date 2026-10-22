# Complete web example

This dependency-free example copies the installed App Stylr CSS and font assets into a static `dist/` directory. It demonstrates a complete install-to-browser path without a framework or bundler.

From this directory in the App Stylr repository:

```sh
npm install
npm run build
npm start
```

Open [http://localhost:4173](http://localhost:4173). Change `data-app-stylr-theme="dark"` to `light` in `index.html`, rebuild, and reload to verify the same component styles against the light theme.

In an outside project, replace the local `file:../..` dependency with `app-stylr@1` or an approved immutable GitHub tag.
