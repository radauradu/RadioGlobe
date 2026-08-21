import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1428",
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: "50%",
            border: "10px solid rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.2) 100%)",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 0 0 8px rgba(255,255,255,0.12)",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
