import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Search, X } from "lucide-react";
import { countries } from "../lib/experience";

export default function CountryPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const trigger = useRef(null),
    dialog = useRef(null),
    search = useRef(null);
  const country = countries.find((item) => item.code === value) || countries[0];
  const results = useMemo(
    () =>
      countries.filter((item) =>
        `${item.name} ${item.code} ${item.dial}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [query],
  );
  useEffect(() => {
    if (!open) return;
    dialog.current.showModal();
    search.current?.focus();
    return () => dialog.current?.close();
  }, [open]);
  const close = () => {
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="gl-country-trigger"
        disabled={disabled}
        aria-label={`Country or region: ${country.name} ${country.dial}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="gl-country-code">{country.code}</span>
        <span>{country.dial}</span>
        <ChevronDown size={14} />
      </button>
      <dialog
        ref={dialog}
        className="gl-country-dialog"
        aria-labelledby="gl-country-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const r = dialog.current.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <header>
          <div>
            <Globe2 size={19} />
            <h2 id="gl-country-title">Your country or region</h2>
          </div>
          <button
            type="button"
            aria-label="Close country picker"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <p>
          Your number can belong to a different region from where you are now.
        </p>
        <label className="gl-country-search">
          <Search size={17} />
          <input
            ref={search}
            aria-label="Search countries or calling codes"
            placeholder="Search country or calling code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="gl-country-results" aria-label="Countries">
          {results.map((item) => (
            <button
              type="button"
              key={item.code}
              aria-pressed={value === item.code}
              onClick={() => {
                onChange(item.code);
                close();
              }}
            >
              <span className="gl-country-code">{item.code}</span>
              <span>{item.name}</span>
              <small>{item.dial}</small>
              {value === item.code && <Check size={16} />}
            </button>
          ))}
          {!results.length && (
            <p role="status">
              No matching country. Try a name or calling code.
            </p>
          )}
        </div>
        <footer>
          {results.length}{" "}
          {results.length === 1 ? "country or region" : "countries and regions"}{" "}
          · International calling codes
        </footer>
      </dialog>
    </>
  );
}
