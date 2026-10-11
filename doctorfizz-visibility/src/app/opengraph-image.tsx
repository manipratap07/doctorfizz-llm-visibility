import { ImageResponse } from "next/og";
import tokens from "../../design-tokens.json";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 80,
        background: tokens.color.bg,
        color: tokens.color.text,
        width: "100%",
        height: "100%",
      }}
    >
      <div style={{ fontSize: 30, color: tokens.color.orange }}>
        DoctorFizz / LLM Visibility Checker
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 88,
          fontWeight: 800,
          marginTop: 80,
        }}
      >
        ARE YOU IN
        <br />
        THE ANSWER?
      </div>
      <div
        style={{ fontSize: 28, marginTop: 30, color: tokens.color.secondary }}
      >
        Check the signal. Read the evidence.
      </div>
    </div>,
    size,
  );
}
