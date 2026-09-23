import React from "react";

/* ── design tokens ── */
export const G = "#009222";
export const Y = "#FFDC00";
export const T = "#20301F";
export const H = "#101F12";
export const ps: React.CSSProperties = { margin: "0 0 16px", fontSize: 15.5, lineHeight: 1.65, color: T };
const h3s: React.CSSProperties = { margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G };

/* ── reusable ── */
export function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G, marginBottom: 16 }}>{children}</div>;
}
export function Ch({ n, title }: { n: string; title: string }) {
  return (<div style={{ marginTop: 48, marginBottom: 20 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G }}>Capítulo {n}</div><h2 style={{ margin: "9px 0 0", fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, letterSpacing: "-0.015em", color: H, lineHeight: 1.2 }}>{title}</h2><div style={{ height: 3, width: 44, background: Y, marginTop: 13 }} /></div>);
}
export function Cl({ n, children }: { n: string; children: React.ReactNode }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: "0 8px", margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.65, color: T }}><span style={{ color: G, fontWeight: 700, fontSize: 13 }}>{n}</span><span>{children}</span></div>);
}
export function Sub({ n, children }: { n: string; children: React.ReactNode }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: "0 8px", margin: "0 0 12px", paddingLeft: 20, fontSize: 14.5, lineHeight: 1.6, color: T }}><span style={{ color: G, fontWeight: 600, fontSize: 12 }}>{n}</span><span>{children}</span></div>);
}
export function Al({ letter, children }: { letter: string; children: React.ReactNode }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: "0 8px", margin: "0 0 8px", paddingLeft: 56, fontSize: 14.5, lineHeight: 1.6, color: T }}><span style={{ color: G, fontWeight: 700 }}>{letter})</span><span>{children}</span></div>);
}
export function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={h3s}>{children}</h3>;
}
export function Tbl({ heads, rows }: { heads: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 24 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, lineHeight: 1.45 }}>
        <thead><tr>{heads.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "10px 12px", background: G, color: "#FFF", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri} style={{ background: ri % 2 === 1 ? "#F3F8F1" : "#FFF" }}>{r.map((c, ci) => <td key={ci} style={{ padding: "10px 12px", borderBottom: "1px solid #DCE5DA", color: T, verticalAlign: "top" }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#FFF", border: "1px solid #DCE5DA", borderLeft: "4px solid #D97706", borderRadius: 6, padding: "16px 20px", margin: "0 0 20px" }}><p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: T }}>{children}</p></div>;
}
export function Warn({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "16px 20px", margin: "0 0 20px" }}><p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#7F1D1D" }}>{children}</p></div>;
}
export function Bullet({ items }: { items: (string | React.ReactNode)[] }) {
  return <>{items.map((item, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", ...ps, margin: "0 0 8px" }}><span style={{ color: G, fontWeight: 700 }}>·</span><span>{item}</span></div>)}</>;
}
export function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return <div style={{ borderLeft: "3px solid " + G, paddingLeft: 16, marginBottom: 12, fontSize: 15, lineHeight: 1.6, color: T }}><strong style={{ color: H }}>{term}:</strong> {children}</div>;
}
