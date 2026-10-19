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

- Ein Klick auf eine freie Stelle öffnet die kompakte Erstellung. Gedrückt halten und ziehen wählt Dauer und Tage vor dem Loslassen. Es gibt keinen zusätzlichen Plus-Schritt.
- Aufgaben ohne Uhrzeit stehen klein im Bereich oben am Tag oder in der Inbox und werden beim Ziehen ins Raster zu Zeitblöcken.
- Eigene Zeitblöcke an der Mitte ziehen, um Tag und Uhrzeit zu verschieben. Den linken oder rechten Seitenrand über weitere Tage ziehen, um dort Kopien zur gleichen Zeit anzulegen.
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

Enthält die begonnene Auswahl neuer Termine durch gedrücktes Ziehen im Kalender, einschließlich Auswahl mehrerer Tage und anschließender Eingabe von Titel, Farbe und Notizen. Typprüfung und die fünf Zeitraster-Tests bestanden. Dieser Abschnitt beschreibt den damaligen GitHub-Zwischenstand. Die nachfolgenden Verbesserungen wurden zusätzlich im Browser geprüft.

Persönliche Datenbanken, importierte Kalenderdaten und API-Schlüssel sind nicht Teil des Repositorys.

## Monats- und Wochenüberblick

Ein Klick auf den Monatsnamen öffnet die Monatsübersicht, ein Klick auf die Tageszahlen die Wochenübersicht. Beide bleiben über dem Stundenkalender sichtbar. Eigene Aufgaben können daraus direkt auf einen Kalenderzeitpunkt gezogen werden. Ein Klick auf ein Datum zeigt die zugehörige Woche. Importierte Termine sind weiterhin schreibgeschützt.

In den Aufgabendetails wählen 1–5 die Farben Grün, Blau, Violett, Orange und Rosa; Texteingaben behalten ihre normale Tastaturbedienung.

## Gemeinsamer Editor und Mehrfachauswahl

Neue Aufgaben und bestehende Aufgaben verwenden denselben Editor mit Beschreibung, Priorität, Farbe, Tags, Unteraufgaben und Notizen. Ein Klick auf eine freie Fläche im Editor verlässt das Textfeld; 1–5 wählen dann die Farbe. Texteingaben bleiben davon ausgenommen. Pfeiltasten wechseln außerhalb von Textfeldern zum nächsten eigenen Termin (hoch/runter am selben Tag, links/rechts zum zeitlich nächsten Block des Nachbartags).

A aktiviert im Kalender ohne Eingabefokus die Rechteckauswahl. Ausgewählte eigene Termine können gemeinsam verschoben, gelöscht oder mit Cmd/Ctrl+C und Cmd/Ctrl+V kopiert werden. Die Abstände bleiben erhalten; Cmd/Ctrl+Z nimmt die gesamte Änderung zurück. Escape beendet die Auswahl. Importierte Termine sind schreibgeschützt.

Wochen- und Monatsübersichten enthalten Aufgaben, separate gespeicherte Notizen, einen Minikalender und Beratung für den jeweiligen Zeitraum. Die direkte KI benötigt weiterhin einen API-Schlüssel; ohne Verbindung steht die Übergabe an ChatGPT bereit.

## Kalender und Inbox (11. Oktober 2026)

Die großen Kalender bieten darunter Aufgaben, Zeitraum-Notizen und Beratung. Aufgaben können in große oder kleine Kalender gezogen werden. Der seitliche Griff erweitert eine geplante Aufgabe über mehrere Tage; danach öffnet sich die gemeinsame Uhrzeit in den Details. Ein Klick auf einen Tag öffnet dessen Woche. Monatseinträge werden chronologisch angezeigt; die Jahresübersicht zeigt Details beim Darüberfahren. Der KI-Planer übernimmt Woche, Monat oder Jahr als Zeitraum.

Die Inbox enthält Essen (TheMealDB), Aktivitäten (Stadt Köln), Orte (Wikipedia), manuell gepflegte Kontakte und eigene Reiter mit Zeit- oder Häufigkeitszielen. WhatsApp ist noch nicht verbunden. Öffentliche Vorschläge enthalten ihre Quelle. Direkte KI-Antworten benötigen weiterhin einen OpenAI-API-Schlüssel.

### Laptop-Erinnerungen

In den Aufgabendetails „Erinnerung · 1 Tag vorher“ aktivieren und speichern. Einmalig `Erinnerungen-aktivieren.command` öffnen oder die Einrichtung unter Einstellungen herunterladen und öffnen. Das richtet einen macOS-LaunchAgent ein, der unabhängig von Browser und Webserver prüft. Der Mac muss angemeldet und eingeschaltet sein; Mitteilungen für osascript/Skripteditor müssen erlaubt sein. Ohne Uhrzeit gilt 09:00. Fällige Erinnerungen werden nach dem Aufwachen nachgeholt, solange der Termin noch bevorsteht.

Der Dienst steht in `~/Library/LaunchAgents/de.raum.reminders.plist`, sein Skript in `scripts/reminder-worker.mjs`. Er speichert bereits gesendete Erinnerungen in `ReminderDelivery` und verschickt jede Aufgabe pro Erinnerungszeit nur einmal. Er benötigt den lokalen Node-Pfad und die App-Dateien; nach Verschieben der App die Einrichtung erneut ausführen.

## Inbox, Essenswoche und Social Circle

Todo sammelt Aufgaben ohne Termin und trennt Woche, Monat und Jahr. Aufgaben lassen sich in Prioritätsbereiche oder auf einen anderen Zeitraum ziehen, anschließend direkt in den Kalender. Reiter lassen sich im geöffneten Bereich umbenennen und über Backspace auf dem Reiter ausblenden. Unter + sind ausgeblendete Reiter wiederherstellbar; Aufgaben bleiben erhalten. Eigene Reiter können Wikipedia-Themenrecherche, öffentliche HTTPS-Quellen, WhatsApp oder die bereits verbundenen Kalender verwenden.

Essen bietet Rezeptbilder und ein manuelles Tagebuch für kcal und die eigene Einschätzung (ausgewogen, gemischt, Genuss). Die Wochenwerte beziehen sich auf erfasste Mahlzeiten, Kalorien werden nicht erfunden. Wetter zeigt die Vorhersage von Open-Meteo für Köln; Sport enthält Bewegungsorte. Veranstaltungsbilder stammen vom Anbieter.

### WhatsApp

Im Social Circle „WhatsApp verbinden“ klicken, den QR-Code mit WhatsApp unter Verknüpfte Geräte scannen und eine vorhandene Person dem WhatsApp-Kontakt zuordnen. Danach werden Kontaktzeitpunkte aktualisiert. Die Anbindung verwendet Baileys und ist keine offizielle WhatsApp-API. Sie speichert Anmeldung und Schlüssel in einer separaten lokalen SQLite-Datei unter data/whatsapp, übernimmt Namen und Kontaktzeitpunkte und sendet keine Nachrichten. Nachrichtentexte werden nicht gespeichert oder an die KI geschickt. „Verbindung trennen“ meldet das verknüpfte Gerät ab und löscht dessen lokale Schlüssel. Für eine frische Installation alle Projektabhängigkeiten installieren, alternativ `npm run whatsapp:setup` für die lokale Verbindung.

Die Nacht von 00–06 Uhr ist eine gemeinsame Zeile. Tageszeiten bleiben bei wiederholten Aufgaben erhalten und sind im Wiederholungsbereich anpassbar. Die Datumsteile der Kopfzeile zeigen beim Darüberfahren einen kleinen Kalender; die große Ansicht wird weiterhin über den separaten Ansichtsbutton gewechselt.

### Inbox, Beziehungen und Verlauf

Die Inboxbreite lässt sich am rechten Rand ziehen und bleibt lokal gespeichert. Todo ist eine gemeinsame Liste: Ziehen blendet Prioritätsflächen an den Einfügepositionen ein; Rot steht über Gelb, Gelb über Grün. Innerhalb der gewählten Priorität bleibt die gewünschte Reihenfolge erhalten. Neue Aufgaben beginnen mit niedriger Priorität. Aufgabenfarbe und Prioritätsstreifen sind getrennt.

Reiternamen werden per Doppelklick bearbeitet; Rechtsklick öffnet ihre Einstellungen mit Internetumschalter und Websites. Eigene Optionen besitzen einen Rhythmus. Beziehungen bietet optionale Kontakt- und Treffintervalle, Gruppen und kompakte Kontaktanzeigen. Die WhatsApp-Anmeldung erfolgt weiterhin am eigenen Telefon über den QR-Code.

Todo und die Aufgabenlisten unter Woche/Monat/Jahr verwenden dieselben Daten. Gewählte Gerichte werden beim Anlegen und Einplanen automatisch erfasst; Fleisch/Fisch und vegetarische Tage werden ausgewertet. Unklare Zutaten, Kalorien und Ernährungseinschätzungen bleiben als unbekannt markiert. Die Statistik zeigt Aufgabenzeit, Erledigung und Gerichte im sichtbaren Zeitraum.

Cmd+Z/Cmd+Y (auch Ctrl) nehmen Änderungen in Aufgaben, Reitern, Beziehungen, Notizen, Design, Inboxbreite und Kalenderimporten zurück bzw. stellen sie wieder her. Der Verlauf umfasst die aktuelle Browsersitzung; unabhängige Änderungen werden bewahrt, Konflikte überschreiben keine neueren Angaben. Texteingaben nutzen den eigenen Bearbeitungsverlauf. Eine externe Anmeldung wird nicht durch Rückgängig abgemeldet. Escape schließt das vorderste Dialogfenster. Termingruppen haben die Löschoptionen einzelner Termin, dieser und folgende oder gesamte Gruppe.

### Kalenderbedienung und Inbox (11. Oktober 2026, aktualisiert)

Im Kalender wechseln Leertaste im Kreislauf zwischen Raster, Aufgaben/Notizen und Zahlenüberblick und Tab zwischen geöffneter und geschlossener Inbox. Texteingaben und Dialoge behalten ihre normale Tastaturbedienung. Escape schließt die zuletzt geöffnete Oberfläche, auch kleine Formulare, Namensbearbeitung, Kalender-Vorschauen und Unterfenster.

Reiter werden direkt per Doppelklick umbenannt und durch Ziehen umgeordnet; die Reihenfolge bleibt gespeichert. Eigene Optionen unterstützen Häufigkeit oder Stunden pro Tag, Woche oder Monat. Wetter zeigt ausschließlich die Vorhersage. Terminblöcke zeigen ihre Titel; genaue Zeiten und Räume stehen im Hover-Hinweis. Die Prioritätsflächen erscheinen nur am jeweiligen aktiven Drop-Slot. Die Swipe-Schwelle bleibt bei 220, die Sperrzeit zwischen Navigationen ist auf 180 ms reduziert.


### Screenshot-Termine prüfen und übernehmen

Datum, Beginn und Dauer lassen sich direkt in Textfelder tippen; die gleichen Felder mit Kalender-, Play- und Sanduhrsymbol erscheinen in Screenshot-Vorschlägen. Datum etwa `16.10.2026`, Uhrzeit etwa `14:30`, Dauer etwa `1,5` Stunden. Die Erkennung unterstützt außerdem `14.00 Uhr`, `14–16 Uhr` und getrennt beschriftete Beginn-/Endzeiten. Mehrdeutige Punktangaben wie `09.05` ohne Zeitkontext bleiben Datumsangaben.

Beim Einfügen eines Screenshots in den Aufgabentitel liest Lifemap den Text lokal aus. Mehrere explizite Termine werden als Vorschau angezeigt, einschließlich abweichender Titel und Uhrzeiten. Gleichnamige Termine erhalten beim gemeinsamen Speichern eine Serienzuordnung. Aus dem Screenshot werden ausschließlich Titel, Datum, Uhrzeiten und Adresse übernommen. Notizen, Beschreibungen und Telefonnummern werden nicht importiert. Bereits selbst eingegebene Notizen bleiben erhalten. Die Adresse wird als eigener Ort gespeichert und ist in den Details als Google-Maps-Link verfügbar.

Erkennbar angegebene tägliche, wöchentliche oder monatliche Wiederholungen erscheinen als änderbarer Vorschlag. Ohne Enddatum wird zunächst ein sichtbarer Zeitraum von acht Wochen verwendet. Zusätzliche Termine, Rhythmus, Enddatum und Anzahl sind vor der Übernahme bearbeitbar. Die aus dem Screenshot geänderten Felder bleiben bis zum erfolgreichen Speichern markiert. Ein Import wird gemeinsam gespeichert und lässt sich mit einer einzigen Rückgängig-Aktion zurücknehmen. Die lokale Erkennung nutzt ausdrückliche Datums- und Zeitangaben; mehrdeutige Screenshots sollten in der Vorschau geprüft werden.

## Shortcut-Hinweise

Beim ersten Öffnen fragt Lifemap, ob passende Tasten und Gesten beim Darüberfahren angezeigt werden sollen. Die Dauer ist frei zwischen 1 und 365 Tagen wählbar; 3, 7, 14 und 30 Tage sind direkt auswählbar. Die Wahl wird für diesen Browser gespeichert. Nach Ablauf verschwinden die Shortcut-Hinweise automatisch, normale Termin-Informationen bleiben erhalten. Unter **Einstellungen → Shortcut-Hinweise** lassen sich die Hinweise deaktivieren oder für eine neue Dauer aktivieren.

## WhatsApp-Kontakte übernehmen

Im Reiter **Beziehungen** öffnet das Buchsymbol neben WhatsApp die Kontaktliste. Nur Personen werden angeboten, keine Gruppen, Status oder Kanäle. Neue Kontakte sind zunächst ausgewählt und mit **Neu** markiert. Häkchenänderungen bleiben auch beim Schließen gespeichert; beim Übernehmen werden die angezeigten Kontakte als geprüft markiert. Später neu erkannte Personen sind erneut markiert und zunächst ausgewählt. Ein weiterer Import aktualisiert verknüpfte Personen, ohne eigene Namen, Gruppen oder Kontaktziele zu ersetzen. Abgewählte bereits importierte Personen werden nicht gelöscht.

Der kleine Aktualisieren-Button übernimmt die letzten Kontaktzeitpunkte aus den von WhatsApp übertragenen Einzelchats für die Personen in Beziehungen. Er kann keine nicht übertragenen älteren Nachrichten rekonstruieren. Verfügbare Profilbilder werden als kleine Bilder lokal in `data/whatsapp/avatars` gespeichert und auch in Kontakt-Aufgaben, Kalenderblöcken und Details gezeigt. Kontakte ohne sichtbares Foto erhalten Initialen. WhatsApp muss über den QR-Code als verknüpftes Gerät verbunden sein. Beim ersten Verbinden kann die Übertragung von Kontakten und Fotos etwas dauern. Kontakte, Bilder und die Auswahl bleiben lokal und gehören nicht in GitHub.

## Neue Vorschläge finden

Der Aktualisieren-Button im Vorschlagsbereich fragt die Quellen neu ab, überspringt den normalen Zwischenspeicher und filtert bereits gezeigte Vorschläge heraus. Bei Essen werden weitere Rezeptgruppen durchsucht; bei Sport und eigenen Online-Themen weitere Suchergebnisse. Veranstaltungen und Ortsideen nutzen auch die weiteren verfügbaren Einträge der jeweiligen Quelle. Wenn gerade keine neuen Treffer vorhanden sind oder eine Quelle ausfällt, bleiben die letzten Vorschläge erhalten und ein Hinweis erscheint. Ein normaler Reiterwechsel verwendet weiterhin den Zwischenspeicher.

### Todoist und offene Wochenaufgaben

In Kalender & Einstellungen → Todoist ein persönliches API-Token aus den [Todoist-Einstellungen](https://app.todoist.com/app/settings/integrations/developer) verbinden. Das Token liegt ausschließlich in einer privaten Datei unter `data/`; die Status-API und Exporte geben es nicht zurück. Die [Todoist API](https://developer.todoist.com/api/v1/) wird alle fünf Minuten gelesen, solange der lokale Server läuft. Der Abgleich läuft von Todoist nach Lifemap. Aufgaben mit Tagesdatum stehen als kompakte Aufgaben neben dem Pluszeichen; ohne festen Tag beziehungsweise mit „diese Woche“ stehen sie in Todo → Woche. Die Todoist-Fälligkeit bleibt als Hinweis erhalten. Lokales Einplanen, Titeländerungen und Farben werden beim Aktualisieren bewahrt.

Die Zahl am Inboxsymbol zählt offene Aufgaben der sichtbaren Woche samt der Wochenablage; erledigte Aufgaben, andere Wochen sowie Monats-/Jahresablage werden nicht mitgezählt.

Screenshot-Vorschläge erkennen `11h` als 11:00 Uhr. Bei Formulierungen wie „Termin vom 19.10 auf Mittwoch 21.10 um 11h“ wird nur das neue Datum übernommen. Fehlende Uhrzeiten werden leer vorgeschlagen statt vom angeklickten Kalenderfeld oder einem anderen Termin übernommen.

### Rechte Ablage und Wochenfläche

Am rechten Bildschirmrand oder über das Ablagesymbol öffnet sich eine lokale Ablage für Ordner, Dateien und Medien. Nur am Rand vorübergehend geöffnete Seitenfenster schließen sich beim Verlassen wieder. Ein Klick auf das Inbox- oder Dokumentesymbol hält das jeweilige Fenster offen, auch während man im Kalender arbeitet. Esc, die Schließen-Schaltfläche oder ein erneuter Klick auf das Symbol schließt es. Auch Tab öffnet die Inbox dauerhaft. Ein Symbolklick in einem nur vorübergehend geöffneten Fenster hält dieses offen. Dateien können über „Hinzufügen“ oder per Drag-and-drop hochgeladen, in Ordner verschoben, umbenannt und entfernt werden. Uploads sind auf 20 Dateien mit zusammen 25 MB begrenzt. Bilder erscheinen als Vorschau, Audio und Video mit Wiedergabe. Entfernen ist reversibel über die Rückgängig-Funktion. Die Inhalte liegen in der lokalen SQLite-Datenbank und werden nicht nach GitHub übertragen.

Die Inbox besitzt einen eigenen Notizkasten unter ihren Aufgaben. Notizen werden nach kurzer Schreibpause automatisch gespeichert, auch ohne das Feld zu verlassen. Die Leertaste oder der untere Bildschirmrand hebt die Aufgaben-/Notizfläche bis zur 18-Uhr-Linie über den Wochenkalender; erneutes Drücken gibt den Kalender frei. Beim Ziehen einer Aufgabe auf den Kalender blenden sich die Ablagen vorübergehend aus und erscheinen nach dem Ablegen wieder. Am linken Rand bleibt das Zurücklegen in die Inbox möglich.

Die Planungsablage unter dem Kalender enthält oben alle Inbox-Reiter, in Wochen-, Monats- und Jahresansicht. Aufgaben stehen kompakt links, längere Notizen rechts und die schlanke KI-Beratung direkt darunter. Fragevorschläge, ChatGPT-Kopieren und -Öffnen sowie Verbindungseinstellungen bleiben verfügbar. Die rechte Ablage heißt „Dokumente“; native Dateizüge an den rechten Rand öffnen sie auch im geschlossenen Zustand. Dateien lassen sich dort ablegen, ansehen und herunterladen. Medienabrufe unterstützen Bytebereiche für Wiedergabe und Spulen.

Die aktuelle Uhrzeit verläuft als eine rote Linie über alle Wochentage; die heutige Spalte ist farblich hervorgehoben. Horizontales Wischen reagiert früher auf bewusste neue Bewegungen, ohne die auslaufende Bewegung mehrfach zu zählen. Die aufklappbare Statistik zeigt freie und belegte Zeit zwischen 06:00 und 24:00 Uhr, einschließlich Kalenderterminen und Wegzeiten; Überschneidungen zählen einmal. Ganztägige Kalendereinträge ohne feste Uhrzeit blockieren dabei keine Stunden.

Trackpad-Wischen richtet sich nach der aktuellen Mausposition, unabhängig vom zuvor angeklickten Element oder einem noch fokussierten Textfeld. Nach einer abgeschlossenen Geste wird die Wischerkennung freigegeben; weitere Kalenderseiten lassen sich ohne Zwischenklick aufrufen. Beim Wechsel zwischen Seitenfenster und Kalender wird die vorige Geste nicht in den neuen Bereich übernommen.

### Auswahl von Kalenderpunkten

„A“ aktiviert die Rechteckauswahl auch in kleinen Kalendern sowie Monats- und Jahresübersichten. Ein Jahrespunkt steht für alle eigenen Aufgaben dieses Tages; zusammengefasste gleichnamige Monatseinträge ebenfalls für alle enthaltenen Aufgaben. Die Auswahl kann über Delete/Backspace gelöscht, per ⌘C kopiert und gemeinsam auf einen anderen Kalendertag gezogen werden. Zahlentasten ändern die Farbe aller ausgewählten Aufgaben. Die Auswahl selbst navigiert nicht in eine andere Ansicht. Verknüpfte schreibgeschützte Kalendertermine bleiben außerhalb der Aufgabenbearbeitung.

### Kompaktes Aufgabenfenster

Beschreibung und Unteraufgaben stehen in einem gemeinsamen Kasten direkt unter dem Titel. Beim Schreiben erscheint ein Plus für die aktuelle Zeile: Klick oder Enter übernimmt sie als Unteraufgabe. Delete/Backspace entfernt zunächst das Plus, ohne Text zu löschen; danach bleibt die Zeile normaler Beschreibungstext. Vorhandene Unteraufgaben lassen sich dort abhaken und entfernen. Zeitangaben erscheinen bei sichtbaren Eingabefeldern nicht zusätzlich als Zusammenfassung. Die zehn nummerierten Farben stehen in zwei Fünferreihen neben der Erinnerung, Prioritätsflaggen und Tags in einer gemeinsamen Zeile.

### Adressbuch und termingerechte Wege

Start und Ziel haben ein Buchsymbol für lokal gespeicherte, benannte Adressen. Die ersten Buchstaben zeigen passende Einträge mit Namenspräfixen zuerst. Hinzufügen und Entfernen lässt sich rückgängig machen; die Daten liegen nur in der privaten lokalen Datenbank. Der Standortbutton am Start verwendet die Browser-Standortfreigabe, alternativ bleibt die Adresse frei eingabbar.

Ohne eindeutige Adresse sucht der Screenshot-Import und das Öffnen der Wegzeitoption nach passenden Orten in Köln. Treffer aus OpenStreetMap und gegebenenfalls öffentlichen Suchergebnissen bleiben Vorschläge mit Quellenlink; erst „Übernehmen“ setzt das Ziel. Es werden nur kurze Orts-/Namenssuchbegriffe recherchiert, kein Screenshotbild und kein vollständiger Mailtext.

Bei ausgefülltem Start, Ziel und Terminzeit werden Wege nach kurzer Eingabepause berechnet. Google-Maps-Links öffnen den Hinweg im Desktop-Browser mit Ankunft bis zur Terminzeit und den Rückweg mit Abfahrt nach dem Terminende. Der Zeitlink verwendet das im Google-Maps-Desktop-UI geprüfte Datenformat; es ist kein offiziell zugesicherter Maps-URL-Parameter und kann auf anderen Geräten abweichen. Fahrradlinks verwenden die offizielle Maps-URL. Die Wegzeitberechnung bleibt bei Fahrplanauskunft bzw. OpenStreetMap; Google-Maps-Verbindungen werden bei Öffnen des Links angezeigt. Die bisherigen grauen Herkunfts- und Langadresszeilen entfallen.

Der Service Worker greift nicht mehr in Seitennavigationen ein. Dadurch bleibt nach einem Serverneustart keine alte Offline-Ersatzseite vor einer wieder erreichbaren Lifemap-Version hängen. Nur alte Shell-Caches werden bereinigt; lokale Kalenderdaten und Einstellungen bleiben erhalten.

### Allgemeine Ablage und Ziele

Unter dem Kalender liegt eine allgemeine Ablage mit Inbox-Reitern, Aufgaben, automatisch gespeicherten Notizen sowie Dateien und Medien. Die Notiz liegt unabhängig von der Kalenderansicht unter dem Schlüssel `storage`; bisherige Zeitraumnotizen bleiben in den Daten erhalten. Dateien teilen sich den lokalen Speicher mit „Dokumente“. Die KI-Einstellungen stehen neben der Überschrift; Frage, ChatGPT-Kopieren und -Öffnen teilen sich eine kompakte Aktionszeile.

„Ziele“ bietet Woche, Monat und Jahr, jeweils für den aktuell im Kalender gezeigten Zeitraum. Vorhandene und neue Reiter werden als Kategorien angeboten, außer Essen und Wetter. Umfang und Einheit werden je Kategorie und Zeitraum separat gespeichert. Eigene Zielkategorien lassen sich hinzufügen; entfernte Kategorien lassen sich wiederherstellen. Aufgaben aus Reitern behalten ihre Kategorie beim Ziehen und Einplanen. Aufgaben können einer Zielkategorie durch Hineinziehen zugeordnet werden, auch gemeinsam ausgewählte Aufgaben. Eigene Kategorien erfassen außerdem Aufgaben mit einem gleichnamigen Tag; Kategoriezuordnungen über bestehende Rhythmus- und Kontakte-Tags bleiben erhalten. Verknüpfte Kalendertermine werden bei passendem Kategorienamen im Titel einbezogen.

Der blasse Balken zeigt eingeplanten Umfang, der kräftige bereits vergangene Terminzeit oder ausdrücklich abgehakte Aufgaben. Bei Stunden wird ein laufender Termin anteilig gezählt; bei Anzahlen erst nach Ende oder Abhaken. Aufgaben ohne Uhrzeit zählen nur zu Anzahlzielen, wenn sie einem Tag zugeordnet sind. Ungeplante Aufgaben füllen den Balken nicht. Zeiträume werden an ihren Tagesgrenzen abgeschnitten.

Die Auswahl mit A zeigt keine zusätzliche Leiste mehr. Ein Klick außerhalb ausgewählter Aufgaben hebt sie auf; ein kurzer Klick im Auswahlmodus beendet diesen. Beim gemeinsamen Ziehen werden alle ausgewählten Aufgaben in der Ziehvorschau dargestellt. Neue Termine bleiben nach dem Schließen des Erstellungsfensters nicht ausgewählt.

Start und Ziel für Wegzeiten unterstützen Ortsnamen und Stichworte. Die Eingabe bietet nach kurzer Pause passende Orte mit Adresse zur Auswahl; gespeicherte Adressen bleiben verfügbar. Dafür wird Photon auf OpenStreetMap-Basis verwendet ([API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)); Nominatim bleibt als Rückfall erhalten. Es werden nur die jeweiligen Suchbegriffe und die eingestellte Stadt gesendet. Mehrdeutige Stichworte müssen vor der Routenberechnung als Ort ausgewählt werden.
