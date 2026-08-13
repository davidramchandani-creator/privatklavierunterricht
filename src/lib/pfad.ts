/**
 * Gehört ein Pfad zu einem Bereich?
 *
 * Klingt nach einer Zeile, die man sich sparen kann. `pathname.startsWith(
 * "/schueler")` tut ja scheinbar dasselbe. Tut es nicht: Das trifft auch auf
 * `/schuelervideos/phia-another-love.mp4` zu. Genau daran sind die
 * Schülervideos gescheitert; jedes einzelne wurde von der Middleware für das
 * Schülerportal gehalten und auf die Loginseite umgeleitet. Im Browser stand
 * dann „Video nicht verfügbar", und niemand wäre von selbst auf die Idee
 * gekommen, dass ein Login-Wächter schuld ist.
 *
 * Dieselbe Falle steht bei `/admin` bereit: `/administration`, `/admin-agb`,
 * `/adminbilder`, alles Pfade, die man arglos anlegt und die dann still
 * hinter der Anmeldung verschwinden.
 *
 * Deshalb wird hier auf **Pfadabschnitte** geprüft: Der Bereich passt, wenn
 * der Pfad genau er selbst ist oder unmittelbar mit einem Schrägstrich
 * weitergeht.
 */
export function gehoertZu(pathname: string, bereich: string): boolean {
  return pathname === bereich || pathname.startsWith(`${bereich}/`);
}
