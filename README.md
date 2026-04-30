# PV-Eigenverbrauchsanalyse

Interaktives Tool zur Optimierung von PV-Anlage und Batteriespeicher..

## Lokal starten

```bash
npm install
npm run dev
```

Dann im Browser http://localhost:5173 oeffnen.

## Build fuer Produktion

```bash
npm run build
```

Erzeugt `dist/` mit fertigen statischen Dateien (HTML, JS, CSS).
Diese koennen auf jeden Webserver oder GitHub Pages hochgeladen werden.

## GitHub Pages Deployment

### Variante A: Automatisch via `gh-pages` Branch

```bash
npm run deploy
```

Pusht `dist/` als `gh-pages`-Branch. Dann in GitHub:
Settings -> Pages -> Source: gh-pages branch -> Save.

URL: `https://<USERNAME>.github.io/<REPO-NAME>/`

### Variante B: Manuell

1. `npm run build` lokal ausfuehren
2. Inhalt von `dist/` in einen Branch pushen, der von GitHub Pages bedient wird
3. In den Repository-Settings unter "Pages" den Branch auswaehlen

## Daten

Eingaben werden im Browser ueber `localStorage` gespeichert.
Daten verlassen den Browser nicht und sind pro Geraet/Browser gespeichert.

## Stack

- React 18
- Vite (Build-Tool)
- Recharts (Charts)
