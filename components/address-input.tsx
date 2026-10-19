"use client";
import { useEffect, useState } from "react";
import { BookOpen, Plus, X, LocateFixed } from "lucide-react";
import { matchingAddresses, type SavedAddress } from "@/lib/address-book";
import { record } from "@/lib/client-history";
import type { PlaceProposal } from "@/lib/place-search";
export default function AddressInput({
  label,
  value,
  onChange,
  onError,
  locate = false,
  onChoose,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onError: (e: unknown) => void;
  locate?: boolean;
  onChoose?: (value: string) => void;
}) {
  const [entries, setEntries] = useState<SavedAddress[]>([]),
    [open, setOpen] = useState(false),
    [focused, setFocused] = useState(false),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [address, setAddress] = useState(""),
    [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<PlaceProposal[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    setPlaces([]);
    if (!focused || value.trim().length < 3 || /^-?\d+\.\d+,/.test(value)) {
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: [value.trim().slice(0, 300)],
          autocomplete: true,
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => {
          if (!controller.signal.aborted) setPlaces(d.proposals || []);
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, focused]);
  useEffect(() => {
    const load = () => {
      fetch("/api/address-book")
        .then((r) => r.json())
        .then((d) => setEntries(d.entries || []))
        .catch(() => {});
    };
    load();
    window.addEventListener("lifemap-addresses", load);
    return () => window.removeEventListener("lifemap-addresses", load);
  }, []);
  const write = async (
    entry: SavedAddress | null,
    expected: SavedAddress | null,
    id: string,
  ) => {
    const r = await fetch("/api/address-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, entry, expected }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setEntries(d.entries);
    window.dispatchEvent(new Event("lifemap-addresses"));
  };
  const choose = (entry: SavedAddress) => {
    onChange(entry.address);
    onChoose?.(entry.address);
    setOpen(false);
    setFocused(false);
  };
  const matches = matchingAddresses(entries, open ? query : value);
  return (
    <div className="saved-address-input">
      <div className="address-input-line">
        <input
          aria-label={label}
          value={value}
          maxLength={1000}
          placeholder="Ort, Stichwort oder Adresse"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {locate && (
          <button
            type="button"
            className="icon-button"
            aria-label="Aktuellen Standort verwenden"
            disabled={busy}
            onClick={() => {
              if (!navigator.geolocation) {
                onError(
                  new Error(
                    "Standort nicht verfügbar. Bitte Adresse eingeben.",
                  ),
                );
                return;
              }
              setBusy(true);
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  onChange(`${p.coords.latitude}, ${p.coords.longitude}`);
                  setBusy(false);
                },
                () => {
                  setBusy(false);
                  onError(
                    new Error(
                      "Standort nicht verfügbar. Bitte Startadresse eingeben.",
                    ),
                  );
                },
                { timeout: 12000, maximumAge: 60000 },
              );
            }}
          >
            <LocateFixed size={16} />
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={`${label}: Adressbuch öffnen`}
          aria-expanded={open}
          onClick={() => {
            setQuery("");
            setOpen((v) => !v);
            setAdding(false);
          }}
        >
          <BookOpen size={16} />
        </button>
      </div>
      {focused && (places.length > 0 || searching) && (
        <div
          className="address-place-results"
          role="listbox"
          aria-label="Ortsvorschläge"
        >
          {searching && <small>Orte werden gesucht …</small>}
          {places.map((p) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={`${p.name}:${p.address}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const selected = `${p.name}, ${p.address}`;
                onChange(selected);
                onChoose?.(selected);
                setFocused(false);
                setPlaces([]);
              }}
            >
              <strong>{p.name}</strong>
              <small>{p.address}</small>
            </button>
          ))}
        </div>
      )}
      {!open && focused && value.trim() && matches.length > 0 && (
        <div className="address-autocomplete">
          {matches.slice(0, 3).map((e) => (
            <button
              type="button"
              key={e.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(e)}
            >
              <strong>{e.name}</strong>
              <small>{e.address}</small>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="address-book-popover" data-escape-layer>
          <button
            type="button"
            hidden
            data-close
            onClick={() => setOpen(false)}
          >
            Schließen
          </button>
          <div className="address-book-header">
            <BookOpen size={15} />
            <strong>Adressbuch</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Adresse hinzufügen"
              onClick={() => {
                setAddress(value);
                setName("");
                setAdding((v) => !v);
              }}
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Adressbuch schließen"
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <input
            autoFocus
            aria-label="Adressbuch durchsuchen"
            placeholder="Name oder Adresse suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {adding && (
            <form
              className="address-book-add"
              data-escape-layer
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const entry = {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  address: address.trim(),
                };
                try {
                  await write(entry, null, entry.id);
                  record({
                    undo: () => write(null, entry, entry.id),
                    redo: () => write(entry, null, entry.id),
                  });
                  setAdding(false);
                  setQuery(entry.name);
                } catch (e) {
                  onError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <button
                type="button"
                hidden
                data-close
                onClick={() => setAdding(false)}
              >
                Schließen
              </button>
              <input
                autoFocus
                aria-label="Adressname"
                placeholder="Name, z. B. Zuhause"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                aria-label="Neue gespeicherte Adresse"
                placeholder="Straße, Hausnummer, Stadt"
                value={address}
                maxLength={1000}
                onChange={(e) => setAddress(e.target.value)}
              />
              <button
                type="submit"
                className="secondary-button"
                disabled={busy || !name.trim() || !address.trim()}
              >
                <Plus size={14} /> Speichern
              </button>
            </form>
          )}
          <div className="address-book-list">
            {matches.map((entry) => (
              <div key={entry.id}>
                <button type="button" onClick={() => choose(entry)}>
                  <strong>{entry.name}</strong>
                  <small>{entry.address}</small>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${entry.name} aus Adressbuch entfernen`}
                  onClick={async () => {
                    try {
                      await write(null, entry, entry.id);
                      record({
                        undo: () => write(entry, null, entry.id),
                        redo: () => write(null, entry, entry.id),
                      });
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {!matches.length && (
              <p>
                {query
                  ? "Keine passende Adresse."
                  : "Noch keine Adressen gespeichert."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
