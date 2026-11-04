// ============================================================
// Partnerschaft mit flowkey
//
// David, 4. November 2026: Er wird Teacher Partner von flowkey (App zum
// Klavierlernen). Seine Schüler bekommen mit seinem Code 25 % Rabatt auf
// jedes flowkey-Abo, er erhält eine Provision und einen kostenlosen
// Premium-Zugang. Er will das auf der Webseite einmal prominent und auf
// einer eigenen Seite zeigen, und zwar offen: dass er daran verdient.
//
// ── Warum es einen Schalter gibt ─────────────────────────
//
// Der Vertrag (Ziffer 4.2) verlangt, dass Werbematerial, das flowkey
// prominent zeigt, vorher von flowkey schriftlich freigegeben wird. Und
// der Code DAVID25 ist erst beantragt. Darum ist alles gebaut, aber
// ausgeschaltet. Erst wenn flowkey zugestimmt und den Code bestätigt hat,
// wird `aktiv` auf true gesetzt. Bis dahin gibt es die Seite nicht
// (404), keinen Abschnitt auf der Startseite und keinen Link im Footer.
//
// Konto bei flowkey: david.privatklavierunterricht@gmail.com.
//
// Nur Angaben, die flowkey selbst macht oder die David bestätigt hat. Was
// flowkey kann, steht hier so, wie es in der Mail von flowkey steht.
// ============================================================

export const FLOWKEY = {
  /** Erst nach Freigabe durch flowkey einschalten (Vertrag 4.2). */
  aktiv: false,
  /** Beantragt am 4. November 2026, noch nicht bestätigt. */
  code: "DAVID25",
  rabattProzent: 25,
  url: "https://www.flowkey.com",
  /**
   * Offizielles Logo von flowkey, sobald flowkey es geschickt hat (Vertrag
   * 4.2: Markenmaterial nur aus den Brand Assets und nach den Brand
   * Guidelines). Datei nach `public/partner/` legen und den Pfad hier
   * eintragen, z. B. "/partner/flowkey-logo.svg". Solange `null`, steht
   * nur Text da.
   */
  logo: null as string | null,
};
