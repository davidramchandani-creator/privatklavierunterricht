import { ImageResponse } from "next/og";
import { BILDMARKE_PFAD, LOGO } from "@/lib/marke";

const hoeheLogo = LOGO.untenMit - LOGO.oben;

/**
 * Das Vorschaubild für geteilte Links.
 *
 * Ohne diese Datei zeigen WhatsApp, iMessage und Facebook einen grauen
 * Kasten mit nacktem Text. Bei Klavierunterricht ist das teuer: Der übliche
 * Weg zu neuen Schülern ist nicht Google, sondern eine Mutter, die den Link
 * in den Klassenchat stellt — und dort entscheidet das Bild darüber, ob
 * jemand tippt.
 *
 * Erzeugt statt hochgeladen: Ein PNG im Repo veraltet still, sobald sich der
 * Satz oder die Farbe ändert. Diese Datei rendert bei jedem Deployment neu
 * und braucht keine Pflege.
 *
 * Kein Foto, weil `next/og` dafür die Datei zur Laufzeit laden müsste — das
 * kostet Zeit und kann fehlschlagen. Typografie auf Markenfarbe ist
 * robuster und in den kleinen Vorschauen ohnehin besser lesbar.
 */

export const alt = "Clavis Klavierschule: Klavierunterricht mit David in Neftenbach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1C244B",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Das Logo als Umrisse: Es braucht keine geladene Schrift. Weiss auf Navy, kein Gold. */}
          <svg
            width={Math.round((LOGO.breite / hoeheLogo) * 150)}
            height={150}
            viewBox={`0 ${LOGO.oben} ${LOGO.breite} ${hoeheLogo}`}
            style={{ marginBottom: 44 }}
          >
            <path d={LOGO.wortmarke} fill="#ffffff" />
            <g transform={LOGO.bildmarkeTransform}>
              <path d={BILDMARKE_PFAD} fill="#ffffff" fillRule="evenodd" />
            </g>
            <path d={LOGO.zusatz} fill="#ffffff" />
          </svg>
          <div
            style={{
              fontSize: 70,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            Spiel, was du fühlst.
          </div>
          <div
            style={{
              fontSize: 70,
              fontWeight: 800,
              color: "#878fc7",
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            Ich zeig dir wie.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: 30, color: "#c3c7e3" }}>
            David Ramchandani · Studio in Neftenbach
          </div>
          <div style={{ fontSize: 26, color: "#6973b9" }}>
            privatklavierunterricht.ch
          </div>
        </div>
      </div>
    ),
    size
  );
}
