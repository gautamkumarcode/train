import { ImageResponse } from "next/og";

// Static-ish brand card, so cache the generated PNG at the edge for a day.
export const runtime = "edge";
export const alt = "YatriKripya departure board glowing inside a dark sleeper coach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundColor: "#0b1020",
          backgroundImage:
            "radial-gradient(120% 120% at 50% -20%, #1c2b4d 0%, #0b1020 60%, #05070f 100%)",
          color: "#f4e9d2",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Top: station nameplate header */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              backgroundColor: "#f5b301",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#f5b301",
            }}
          >
            YatriKripya · yatrikripyadhyandein.in
          </div>
        </div>

        {/* Middle: departure-board title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            Live Train,
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, color: "#f5b301" }}>
            Lo-Fi Carriage.
          </div>
          <div style={{ fontSize: 32, color: "rgba(244,233,210,0.75)", maxWidth: 900 }}>
            Track any 5-digit Indian Railways train inside a nostalgic sleeper coach —
            looping ambience, platform chai, loco horns & the emergency chain.
          </div>
        </div>

        {/* Bottom: animated-looking rail strip + status chips */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              gap: 12,
            }}
          >
            {["ON TIME", "DELAYED", "CHAIN PULLED"].map((chip) => (
              <div
                key={chip}
                style={{
                  fontSize: 20,
                  letterSpacing: 2,
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "2px solid rgba(245,179,1,0.4)",
                  color: "#f4e9d2",
                  display: "flex",
                }}
              >
                {chip}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 22, color: "rgba(244,233,210,0.6)" }}>
            Platform 3 · Sleeper Coach S4
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
