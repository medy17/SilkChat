export function ThemeScript() {
    const scriptContent = `
    (function() {
      const storageKey = "theme-store";
      const root = document.documentElement;
      const DEFAULT_FONT_WEIGHTS = ["400"];
      const SYSTEM_FONTS = new Set([
        "ui-sans-serif",
        "ui-serif",
        "ui-monospace",
        "system-ui",
        "sans-serif",
        "serif",
        "monospace",
        "cursive",
        "fantasy"
      ]);

      function extractFontFamily(fontFamilyValue) {
        if (!fontFamilyValue) return null;

        const firstFont = fontFamilyValue.split(",")[0]?.trim();
        if (!firstFont) return null;

        const cleanFont = firstFont.replace(/['"]/g, "");
        if (SYSTEM_FONTS.has(cleanFont.toLowerCase())) {
          return null;
        }

        return cleanFont;
      }

      function buildFontCssUrl(family, weights) {
        weights = weights || DEFAULT_FONT_WEIGHTS;
        const normalizedFamily = family.trim().replace(/\\s+/g, "+");
        const weightsParam = weights.join(";");
        return \`https://fonts.googleapis.com/css2?family=\${normalizedFamily}:wght@\${weightsParam}&display=swap\`;
      }

      function ensureFontStylesheet(family, weights) {
        const href = buildFontCssUrl(family, weights);
        const existing = document.querySelector(\`link[data-theme-font="\${family}"], link[href="\${href}"]\`);
        if (existing) return;

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.setAttribute("data-theme-font", family);
        document.head.appendChild(link);
      }

      let themeState = null;
      try {
        const persistedStateJSON = localStorage.getItem(storageKey);
        if (persistedStateJSON) {
          themeState = JSON.parse(persistedStateJSON)?.state?.themeState;
        }
      } catch (e) {
        console.warn("Theme initialization: Failed to read/parse localStorage:", e);
      }

      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const mode = themeState?.currentMode ?? (prefersDark ? "dark" : "light");
      const baseStyles = themeState?.cssVars?.theme;

      const activeStyles =
        mode === "dark"
          ? themeState?.cssVars?.dark
          : themeState?.cssVars?.light;

      if (!baseStyles && !activeStyles) {
        return;
      }

      const stylesToApply = {
        ...(baseStyles || {}),
        ...(activeStyles || {})
      };

      for (const styleName of Object.keys(stylesToApply)) {
        const value = stylesToApply[styleName];
        if (value !== undefined) {
          root.style.setProperty(\`--\${styleName}\`, value);
        }
      }

      root.setAttribute("data-theme", mode);
      root.classList.toggle("dark", mode === "dark");
      root.classList.toggle("light", mode === "light");

      const fontValues = [
        stylesToApply["font-sans"],
        stylesToApply["font-serif"],
        stylesToApply["font-mono"]
      ];

      for (const fontValue of fontValues) {
        const family = extractFontFamily(fontValue);
        if (!family) continue;
        ensureFontStylesheet(family);
      }
    })();
  `

    return (
        <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: this script needs to execute immediately
            dangerouslySetInnerHTML={{ __html: scriptContent }}
            suppressHydrationWarning
        />
    )
}
