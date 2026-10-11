# Raum – persönlicher Wochenplaner

Eine lokale Web-App mit installierbarer PWA-Oberfläche. Erst sammeln, dann einplanen: Inbox links, Woche in der Mitte, Aufgabendetails rechts. Auf dem Smartphone steht der einzelne Tag im Mittelpunkt.

## Start auf diesem Mac

`Start.command` per Doppelklick starten und **http://127.0.0.1:3000** im Browser öffnen. Das Terminal muss geöffnet bleiben. Mit `Ctrl+C` wird der Server beendet. Wenn die App bereits läuft, reicht der Browser-Link.

Die Startdatei nutzt eine vorhandene Node-Installation oder die auf diesem Rechner vorhandene Codex-Laufzeit. Sie installiert nichts im Hintergrund. Falls Abhängigkeiten fehlen, gelten die Schritte unten.

## Start auf einem anderen Rechner

Voraussetzung: **Node.js 24 oder neuer** und pnpm.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Entwicklung:

```sh
pnpm dev
```

Bei `EMFILE` auf macOS: `WATCHPACK_POLLING=true pnpm dev`.

## Bedienung

- Aufgabe in der Inbox oder in einem Tag eingeben und Enter drücken.
- Eine Karte öffnet ihre Details. Änderungen mit „Speichern“ bestätigen; beim Schließen werden sie ebenfalls gespeichert.
- Zum Verschieben den Griff oben rechts an der Karte ziehen. Auf dem Smartphone kann auch auf die Tagesknöpfe oder „Inbox“ gezogen werden.
- Innerhalb eines Tages verändert Drag & Drop die Reihenfolge. Der Griff unterstützt auch Tastaturbedienung: Leertaste, Pfeile, erneut Leertaste; Escape bricht ab.
- Nach Löschen oder Verschieben ist „Rückgängig“ für 15 Sekunden verfügbar.
- `N`: neue Aufgabe; `T`: heute; `Cmd/Ctrl+K`: Suche.
- Suche berücksichtigt alle Aufgaben. Treffer aus anderen Wochen stehen unter der aktuellen Woche.
- Geplanter Tag und Fälligkeit sind unabhängig. Ein Freitagstermin kann am Mittwoch vorbereitet werden.
- Tags werden in den Details mit Komma getrennt eingegeben.
- Hell/Dunkel über das Mondsymbol wechseln. Die Wahl bleibt in diesem Browser gespeichert.

## Kalender

Unter „Kalender & Einstellungen“ eine `.ics`-Datei importieren oder eine öffentliche HTTPS-/iCal-Adresse eintragen. Kalenderereignisse sind schreibgeschützt und werden farblich von Aufgaben unterschieden.

URL-Abonnements werden bei laufendem Server automatisch alle 15 Minuten synchronisiert, auch wenn kein Browser geöffnet ist. Nach Serverstart werden fällige Abonnements sofort nachgeholt; der Scheduler prüft jede Minute. Beim Aufwachen des Rechners folgt die nächste fällige Aktualisierung. Bei Fehlern bleiben die zuletzt geladenen Termine erhalten und nach 5 Minuten folgt ein neuer Versuch. Status und letzter erfolgreicher Abruf stehen bei jedem Kalender. Mit dem Aktualisieren-Symbol kann jederzeit manuell synchronisiert werden. Die geöffnete Oberfläche übernimmt Änderungen spätestens nach 30 Sekunden bzw. beim Zurückwechseln in das Fenster. ICS-Dateien werden nur einmalig importiert. Wiederholungen werden für ein Jahr zurück und zwei Jahre im Voraus materialisiert. Unterstützt sind Ganztag, Serien, `EXDATE`, Ausnahmeereignisse und Zeitzonen. Dateien dürfen höchstens 2 MB groß sein; die Anzahl der expandierten Termine ist begrenzt. Kalender mit sehr häufigen oder sehr alten Wiederholungen können einen kürzeren Exportzeitraum benötigen. Floating-Zeiten ohne Zeitzone verwenden die Server-Zeitzone.

Die `CalendarProvider`-Schnittstelle hat `connect`, `getEvents`, `sync` und `disconnect`. Google, iCloud, Outlook, Universität oder Studo können später eigene Adapter erhalten. Es gibt keine feste Studo-Abhängigkeit und keine vorgetäuschten OAuth-Verbindungen.

## KI-Assistent

`.env.example` als `.env.local` kopieren, den API-Key lokal eintragen und den Server neu starten:

```dotenv
OPENAI_API_KEY=dein_api_key
OPENAI_MODEL=gpt-4.1-mini
```

Der Modellname ist konfigurierbar. Der Schlüssel wird ausschließlich serverseitig gelesen. Aufgaben-Kontext und die letzten 16 Chatnachrichten werden bei einer aktiven Anfrage an die OpenAI Responses API gesendet. Der Chatverlauf bleibt in der lokalen SQLite-Datenbank; API-seitiges Speichern wird mit `store: false` deaktiviert. Das schließt die beim Anbieter geltenden Aufbewahrungsregeln nicht aus.

Alle fünf Schnellaktionen und freier Chat sind implementiert. Die KI kann keine Aufgaben schreiben. Vorgeschlagene Schritte werden zunächst angezeigt, dann ausdrücklich übernommen und anschließend gespeichert. Ohne Key erscheint ein verständlicher Konfigurationshinweis. Ein echter OpenAI-Aufruf wurde mangels Key nicht getestet.

Implementationsreferenz: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## PWA und mehrere Geräte

Raum funktioniert direkt im Browser. Unterstützte Browser bieten „App installieren“, „Zum Dock hinzufügen“ oder „Zum Home-Bildschirm“ an. Auf diesem Mac ist `localhost` ein installierbarer Kontext. Die installierte Oberfläche benötigt weiterhin einen erreichbaren Server; offline zeigt sie einen Wiederverbindungshinweis. **Offline-Bearbeitung ist nicht implementiert.**

Diese Version bindet den Server bewusst an `127.0.0.1` und verwendet ein lokales Profil. Ein Smartphone kann daher noch nicht auf diese laufende lokale Instanz zugreifen. Die mobile Oberfläche ist vorbereitet und getestet; für den echten Zugriff von mehreren Geräten sind HTTPS-Hosting, Anmeldung und Synchronisation noch zu ergänzen. **Es wurde nichts öffentlich bereitgestellt.**

## Daten und Sicherung

Die Datenbank liegt unter `data/raum.sqlite`, optional über `DATABASE_PATH` änderbar. Aufgaben, Unteraufgaben, Tags, Kalender, Tagesnotizen und Chats überstehen Browser- und Server-Neustarts. SQLite kann zusätzlich `-wal`- und `-shm`-Dateien anlegen.

„Datensicherung herunterladen“ exportiert Aufgaben, Kalenderereignisse, Tagesnotizen und Chats als JSON. Private Abonnement-URLs und API-Keys sind nicht im JSON enthalten. Eine JSON-Wiederherstellungsoberfläche ist noch nicht implementiert. Für eine vollständige Sicherung den Server stoppen und den gesamten Ordner `data/` zusammen mit `.env.local` sicher kopieren. Niemals laufende SQLite-Dateien einzeln kopieren.

## Architektur

- Next.js App Router, React, TypeScript; eigene schlanke CSS-Komponenten.
- dnd-kit für Pointer-, Touch- und Tastatur-Drag & Drop.
- SQLite über die Node-API, mit Repository-Funktionen und vorbereiteten SQL-Anweisungen; kein zusätzlicher ORM nötig.
- Normalisierte Tabellen: `User`, `Todo`, `Subtask`, `Tag`, `TodoTag`, `CalendarConnection`, `CalendarEvent`, `TodoChat`, `TodoChatMessage`, `DayNote`.
- Kalender-Adapter und KI-Route sind vom Aufgabenmodell getrennt.
- Fonts liegen lokal bei und verursachen keine Anfragen an Google Fonts.
- Der Service Worker speichert nur Offline-Hinweis und Icons. Aufgaben- und Chat-API werden nicht gecacht.

Die Web-App hat aktuell ein lokales Profil. Benutzerkonten, Cloud-Synchronisation und native Apps sind die nächste Ausbaustufe, kein Teil dieser lokalen Version.

## Tests

```sh
pnpm test             # Datum, Netzwerkadressen, automatischer Kalenderabgleich
pnpm test:api         # benötigt laufende App auf 127.0.0.1:3000
pnpm test:server      # nach pnpm build: prüft Hintergrundstart ohne Browser
pnpm build           # Produktions-Build einschließlich Typprüfung
```

API-Tests legen ausschließlich temporäre Testdaten an und entfernen sie anschließend. `TEST_BASE_URL` kann auf eine separate Testinstanz zeigen. Die Tests prüfen CRUD, Planung, Reihenfolge, Wiederherstellung, Eingabevalidierung, fremde Origins, ICS-Serien samt Ausnahmen und den Fehlerfall ohne API-Key.

Zusätzlich manuell im Browser geprüft: schnelles Erstellen, Details samt Unteraufgaben, Datumseingaben, Drag & Drop, Erledigen, Löschen/Undo, Persistenz nach Neustart, mobile Tagesansicht und Inbox, ICS-Dateiimport.

Der Kalender nutzt eine kompakte Werkzeugleiste ohne Begrüßungsblock. In schmalen Desktopfenstern ist die Inbox zunächst eingeklappt; sie lässt sich über das Seitenleisten-Symbol neben der Datumsanzeige öffnen.

## Stundenkalender

Die kompakte Werkzeugleiste vereint Wochenwechsel, Suche, Filter und Einstellungen. Der Kalender scrollt unabhängig von der Leiste und passt auf üblichen Fensterhöhen 06:00 bis 24:00 in die sichtbare Fläche ein. Darunter folgen 00:00 bis 06:00 desselben Kalendertags.

- Eine freie Stelle im Stundenraster anklicken, um die Einfügestelle zu markieren. Doppelklick oder das Plus an der Markierung öffnet eine neue Aufgabe mit Uhrzeit und Notizen.
- Aufgaben ohne Uhrzeit stehen klein im Bereich „Ohne Zeit“ oder in der Inbox und werden beim Ziehen ins Raster zu Zeitblöcken.
- Eigene Zeitblöcke seitlich auf einen anderen Tag ziehen: Dort entsteht eine Kopie zur ursprünglichen Uhrzeit. Das Original bleibt erhalten. Vertikales Ziehen innerhalb desselben Tages verschiebt die Uhrzeit.
- Nach dem Anklicken löscht Delete/Backspace den ausgewählten eigenen Termin, solange der Fokus nicht in einem Textfeld liegt. Der Hinweis „Rückgängig“ stellt ihn wieder her.
- Oberen oder unteren Rand eines Zeitblocks ziehen, um Beginn oder Ende in 15-Minuten-Schritten anzupassen. Die fokussierten Griffe unterstützen auch die Pfeiltasten. Änderungen können über „Rückgängig“ zurückgenommen werden.
- Fünf Farben (Grün, Blau, Violett, Orange, Rosa) sind beim Anlegen und in den Aufgabendetails wählbar und werden lokal gespeichert.
- Gleichzeitige Termine erscheinen nebeneinander. Importierte Kalendertermine bleiben schreibgeschützt.

## Wiederholungen und zentrale KI-Planung

In den Aufgabendetails gibt es keine Datums-/Zeiteingaben mehr. Wochentage auswählen und Wiederholungen über 4, 8, 12, 26 oder 52 Wochen anlegen. Die zukünftigen Vorkommen werden als einzelne Aufgaben gespeichert; erneutes Anlegen derselben Quellaufgabe und Tage erzeugt keine Duplikate. Änderungen betreffen immer nur den einzelnen Termin. Importierte Kalendertermine bleiben schreibgeschützt.

Die neue KI-Zeile öffnet die Wochen- und Zielberatung. Ein Zeitraum von 1 bis 26 Wochen ist auswählbar. Die KI berücksichtigt vorhandene Aufgaben und Termine, zeigt eine Vorschau mit bis zu 80 neuen Aufgaben und trägt diese erst nach „Aufgaben übernehmen“ ein. Erneutes Übernehmen desselben Vorschlags ist idempotent. Gesprächsverlauf und Vorschläge bleiben lokal gespeichert.

Ein API-Schlüssel kann direkt in der KI-Planung oder im Aufgabenchat verbunden werden. Er wird serverseitig geprüft und mit Dateirechten 0600 in `data/ai-config.json` gespeichert. Es ist kein Neustart nötig. Alternativ funktioniert weiterhin `OPENAI_API_KEY` in `.env.local`. Schlüssel werden weder an den Browser zurückgegeben noch im Datenexport oder Quellcode-ZIP aufgenommen. Beim Absenden werden Nachricht und Planungskontext an OpenAI gesendet (`store: false`).

Diktieren nutzt die Spracherkennung des Browsers, falls verfügbar und erlaubt; je nach Browser kann dessen Sprachdienst Audio verarbeiten. Das Transkript ist vor dem Absenden editierbar. Alternativ kann man tippen oder die Diktierfunktion des Betriebssystems verwenden.

Die Tests für die neue KI-Planung verwenden simulierte OpenAI-Antworten und eine eigene temporäre Datenbank. Ein echter API-Aufruf erfordert einen gültigen API-Schlüssel. API-Format: [offizielle OpenAI-Dokumentation zu Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Kopieren, Rückgängig und Tagesansicht

Ein ausgewählter eigener Block kann mit ⌘C (Windows/Linux: Ctrl+C) kopiert werden. Einen freien Kalenderpunkt anklicken und mit ⌘V einfügen. Titel, Notizen, Farbe und Dauer werden übernommen; IDs sind neu. Textfelder behalten ihre normalen Kopier-/Einfügefunktionen. ⌘Z nimmt die letzte Aufgabenänderung zurück (bis 50 Schritte während der aktuellen Sitzung), einschließlich Duplizieren, Anlegen, Verschieben, Wiederholen und Löschen. Neuere, zwischenzeitliche Änderungen werden nicht überschrieben.

Die Aufgabendetails sind kompakter, mit der KI-Option direkt oben. Beim Anlegen lassen sich sofort Notizen ergänzen. Heute wird in der Tagesüberschrift markiert. Ein Klick auf den Tagesnamen öffnet Aufgaben, große Tagesnotiz und eine Tagesauswertung in einer gemeinsamen Ansicht. Die sofort verfügbare Auswertung berechnet offene Aufgaben, geplante Zeit und Überschneidungen regelbasiert und ist ausdrücklich keine KI-Antwort. Die Tages-KI benötigt dieselbe API-Verbindung; Fragen und Antworten werden pro Datum gespeichert.

Ohne API-Verbindung gibt es in Aufgaben-, Tages- und Wochenansicht „Für ChatGPT kopieren“ und einen Link zu ChatGPT. Damit wird ein Kontexttext in die Zwischenablage kopiert, den der Nutzer in ChatGPT einfügen kann. Antworten und Pläne werden dabei nicht automatisch in die App zurückübertragen. Eine bestehende ChatGPT-Anmeldung aktiviert die API-Anbindung dieser App nicht automatisch.

## Zwischenstand vom 11. Oktober 2026

Enthält die begonnene Auswahl neuer Termine durch gedrücktes Ziehen im Kalender, einschließlich Auswahl mehrerer Tage und anschließender Eingabe von Titel, Farbe und Notizen. Typprüfung und die fünf Zeitraster-Tests bestanden. Die neueste Zieh-Funktion ist noch nicht vollständig im Browser geprüft; dieser Commit dient als Entwicklungs-Zwischenstand.

Persönliche Datenbanken, importierte Kalenderdaten und API-Schlüssel sind nicht Teil des Repositorys.
