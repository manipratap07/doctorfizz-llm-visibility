"use client";
import { useState } from "react";
export default function DeleteData() {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        className="secondary-button"
        onClick={async () => {
          const r = await fetch("/api/data/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const j = await r.json();
          setMessage(
            r.ok
              ? "Your browser-associated content has been deleted."
              : j.error,
          );
        }}
      >
        Delete my stored content
      </button>
      <p role="status">{message}</p>
    </>
  );
}
