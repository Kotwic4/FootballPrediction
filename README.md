# Typer Mistrzostw Świata 2026 ⚽

Statyczna aplikacja webowa (React + Vite) do rodzinnego typowania meczów
Mistrzostw Świata 2026 — typy fazy grupowej (1 / X / 2) oraz drużyn awansujących
w fazie pucharowej. Dane wczytywane i zapisywane są w formacie Excel (`.xlsx`),
zgodnym z arkuszem rodzinnym.

## Jak to działa

- **Faza grupowa** — dla każdego z 72 meczów wybierasz `1` (wygrana pierwszej
  drużyny), `X` (remis) lub `2` (wygrana drugiej). Za trafienie: **1 pkt**.
  Pod każdą grupą wyświetla się **tabela liczona na żywo** (punkty + bezpośrednie
  spotkania jako rozstrzygnięcie remisu). Miejsca 1–2 awansują, 3. miejsce gra
  o jedno z **8 miejsc dla najlepszych trzecich drużyn** (osobna tabela na dole).

  > Uwaga: typy to tylko `1/X/2`, więc bez bramek niektórych remisów w tabeli
  > nie da się rozstrzygnąć — takie pozycje są oznaczone symbolem ⚖︎.

- **Faza pucharowa** — dla każdej rundy zaznaczasz drużyny, które do niej
  awansują. Wybór 1/16 jest dowolny (drużyny awansujące wg Twoich tabel mają
  podpowiedź „awans”; przycisk „Uzupełnij z tabel grupowych” wypełnia rundę
  automatycznie). Od 1/8 finału można wybierać **tylko spośród drużyn z
  poprzedniej rundy** — usunięcie drużyny we wcześniejszej rundzie usuwa ją też
  z kolejnych.

- **Drzewo** — interaktywna, oficjalna drabinka MŚ 2026. Wymaga uzupełnienia
  wszystkich 72 meczów grupowych. Miejsca 1–2 z grup przydzielane są
  automatycznie, Ty wybierasz **8 z 12** drużyn z 3. miejsc (przydział do
  konkretnych par liczony jest automatycznie wg reguł FIFA), a następnie
  klikasz zwycięzców kolejnych meczów aż do finału i meczu o 3. miejsce.
  Zakładka „Drzewo” i „Faza pucharowa” edytują te same typy.

  Punktacja rund:

  | Runda | Drużyn | Pkt / drużynę | Max |
  |-------|:------:|:-------------:|:---:|
  | 1/16 finału | 32 | 1 | 32 |
  | 1/8 finału | 16 | 2 | 32 |
  | Ćwierćfinał | 8 | 3 | 24 |
  | Półfinał | 4 | 4 | 16 |
  | Finał | 2 | 5 | 10 |
  | Trzecie miejsce | 1 | 5 | 5 |
  | Mistrz | 1 | 10 | 10 |

  Faza grupowa daje maks. 72 pkt → **łącznie maks. 201 pkt**.

- **Zapis i wczytywanie** — typy zapisują się automatycznie w przeglądarce
  (localStorage). Przyciskiem **„Zapisz do Excel”** pobierzesz plik `.xlsx`,
  który możesz wysłać rodzinie. Przyciskiem **„Wczytaj Excel”** wczytasz
  częściowo lub w pełni wypełniony plik i kontynuujesz typowanie.

## Uruchomienie lokalne

Wymagany Node.js 18+.

```bash
npm install
npm run dev      # serwer deweloperski (http://localhost:5173)
npm run build    # produkcyjny build do katalogu dist/
npm run preview  # podgląd buildu produkcyjnego
```

## Publikacja na GitHub Pages

Wdrożenie jest automatyczne dzięki GitHub Actions (`.github/workflows/deploy.yml`):

1. W repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Każdy `push` na gałąź `main` buduje aplikację i publikuje ją pod adresem
   **https://kotwic4.github.io/FootballPrediction/**.

> Ścieżka bazowa (`base`) w `vite.config.js` jest ustawiona na `/FootballPrediction/`
> i musi odpowiadać nazwie repozytorium.

## Struktura projektu

```
src/
├── data/tournament.js    # dane turnieju (mecze, grupy, rundy, punktacja)
├── standings.js          # tabele grup + ranking najlepszych trzecich miejsc
├── knockout.js           # zagnieżdżanie rund (kandydaci + kaskadowe usuwanie)
├── bracket.js            # oficjalna drabinka 2026 + przydział 3. miejsc (matching)
├── components/
│   ├── GroupStage.jsx     # typowanie fazy grupowej (1/X/2) + tabele
│   ├── KnockoutStage.jsx  # typowanie fazy pucharowej (zagnieżdżone rundy)
│   ├── BracketStage.jsx   # interaktywna drabinka „Drzewo”
│   ├── Standings.jsx      # współdzielone tabele wyników
│   └── ProgressPanel.jsx  # zwijany panel postępu
├── excel.js              # eksport/import .xlsx (SheetJS)
├── App.jsx               # stan, zakładki, zapis lokalny
└── styles.css
```

Dane turnieju zostały wygenerowane z arkusza `WORLD CUP 2026.xlsx`. Aby użyć
aplikacji dla innego turnieju (np. Euro), wystarczy podmienić `src/data/tournament.js`.

## Uwaga

Import plików `.xlsx` opiera się na bibliotece SheetJS. Wczytuj wyłącznie pliki
pochodzące od rodziny / wyeksportowane z tej aplikacji.
