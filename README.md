# Asteroid Arcade

Ein simples, sofort spielbares **Asteroids-Arcade-Spiel** als reine statische Website (HTML, CSS, JavaScript).

## Lokal starten

1. Repository klonen oder herunterladen.
2. `index.html` im Browser öffnen.

Optional (empfohlen für sauberes Hosting-Verhalten):

```bash
python3 -m http.server 8080
```

Dann im Browser öffnen: `http://localhost:8080`

## Statisches Hosting (GitHub Pages)

1. Projekt in ein GitHub-Repository pushen.
2. In GitHub: **Settings → Pages** öffnen.
3. Bei **Build and deployment** als Source **Deploy from a branch** wählen.
4. Branch `main` (oder gewünschter Branch) und Ordner `/ (root)` auswählen.
5. Speichern – nach kurzer Zeit ist die Vorschau unter der Pages-URL verfügbar.

## Steuerung

- **Pfeil links/rechts**: Schiff drehen
- **Pfeil hoch**: Schub
- **Leertaste**: Schießen
- **Enter**: Nach Game Over neu starten

## Gameplay-Features

- Trägheitsbasierte Schiffsteuerung
- Bildschirm-Wrapping für Schiff, Schüsse und Asteroiden
- Asteroiden in mehreren Größen, große splitten in kleinere
- Kollisionen kosten Leben (Start: 3)
- Score-System + Wellenfortschritt
- Game-Over-Overlay mit sauberem Neustart

## Projektstruktur

```text
.
├── index.html    # Grundstruktur + Canvas
├── style.css     # Retro-Optik / Layout
├── script.js     # Spiel-Logik (Loop, Input, Rendering, Kollisionen)
└── README.md     # Kurzanleitung
```
