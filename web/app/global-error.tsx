"use client";

// Replaces the root layout when a top-level error occurs, so it must render
// its own <html>/<body> with inline styles (theme CSS isn't guaranteed here).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0a14",
          color: "#efecf8",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h2>
        <button
          onClick={reset}
          style={{
            marginTop: 20,
            borderRadius: 12,
            border: "none",
            background: "#8b5cf6",
            color: "#fff",
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
