const PINK_LIGHT = "#ffe8f4";
const PINK_MID = "#ff7eb8";
const PINK_DEEP = "#e84a9a";
const PINK_SHADOW = "#9a2860";

export function PinkRadioFavicon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "82%",
          height: "82%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Antenna */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "4%",
            left: "28%",
            width: "10%",
            height: "34%",
            transform: "rotate(-18deg)",
            transformOrigin: "bottom center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "999px",
              background: `linear-gradient(180deg, ${PINK_LIGHT} 0%, ${PINK_DEEP} 100%)`,
              boxShadow: `inset 0 2px 4px rgba(255,255,255,0.45)`,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "2%",
            left: "24%",
            width: "16%",
            height: "16%",
            borderRadius: "50%",
            background: PINK_MID,
            boxShadow: `0 0 0 3px ${PINK_LIGHT}`,
          }}
        />

        {/* Radio body */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "8%",
            left: "10%",
            width: "80%",
            height: "58%",
            borderRadius: "22%",
            background: `linear-gradient(145deg, ${PINK_LIGHT} 0%, ${PINK_MID} 38%, ${PINK_DEEP} 72%, ${PINK_SHADOW} 100%)`,
            boxShadow:
              "inset 0 10px 18px rgba(255,255,255,0.35), inset 0 -14px 22px rgba(80, 12, 48, 0.45)",
          }}
        >
          {/* Speaker grille */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "7%",
              width: "52%",
              height: "100%",
              padding: "14% 10% 14% 14%",
            }}
          >
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  height: "10%",
                }}
              >
                {[0, 1, 2, 3, 4].map((col) => (
                  <div
                    key={col}
                    style={{
                      width: "14%",
                      height: "100%",
                      borderRadius: "999px",
                      background: "rgba(90, 14, 52, 0.42)",
                      boxShadow: "inset 0 1px 2px rgba(255,255,255,0.15)",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Dial + controls */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10%",
              width: "48%",
              height: "100%",
              padding: "12% 12% 12% 6%",
            }}
          >
            <div
              style={{
                display: "flex",
                position: "relative",
                width: "58%",
                height: "58%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 32% 28%, ${PINK_LIGHT} 0%, ${PINK_MID} 45%, ${PINK_DEEP} 100%)`,
                  boxShadow:
                    "inset 0 4px 10px rgba(255,255,255,0.5), inset 0 -6px 12px rgba(70, 10, 42, 0.5)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "22%",
                  right: "18%",
                  width: "22%",
                  height: "22%",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.75)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "12%",
                width: "70%",
                height: "14%",
              }}
            >
              <div
                style={{
                  flex: 1,
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.35)",
                }}
              />
              <div
                style={{
                  flex: 1,
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.35)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Signal waves */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "18%",
            right: "6%",
            gap: "6%",
            width: "22%",
            height: "18%",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              width: "18%",
              height: "35%",
              borderRadius: "999px",
              background: PINK_MID,
              opacity: 0.85,
            }}
          />
          <div
            style={{
              width: "18%",
              height: "62%",
              borderRadius: "999px",
              background: PINK_DEEP,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              width: "18%",
              height: "100%",
              borderRadius: "999px",
              background: PINK_SHADOW,
            }}
          />
        </div>
      </div>
    </div>
  );
}
