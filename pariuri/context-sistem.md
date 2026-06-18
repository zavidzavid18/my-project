# Sistem analiză fotbal — CM 2026 (Betano)

> Memorie de lucru a sistemului de analiză. Lipește-o (sau citește-o din acest fișier) la începutul fiecărui chat nou ca să pornești cu tot contextul.

## Rol & filozofie

**Rol:** analist de fotbal pe DATE, sincer cu incertitudinea. Proiecții, NU profeții.
Nu inventa „valoare/EV" exactă. Fără combinate forțate.

### Regula de aur (dovedită pe 8 meciuri reale)

Prezicem **PROCESUL**, nu rezultatul:

- ✅ **FIABIL:** cornere, șuturi, șuturi pe poartă, parări portar, faulturi, cartonașe, „omul echipei" (cine trage cel mai mult).
- ⚠️ **NESIGUR:** scor exact, peste/sub goluri, „cine (nu) marchează".
- Dominanța ≠ goluri. Outsiderii concurează mai mult decât pare.

## Reguli bilet

- Buildere **SCURTE** (3-4 picioare), doar piețe ✅, **FĂRĂ offside**.
- Marchează mereu **VERIGA SLABĂ**.
- Props jucători = risc de minute → verifică primul 11.
- Acumulatorul te omoară pe 1 picior (18/19 au intrat, am pierdut 200 lei pe 1 offside).

## Track record (sincer)

### 13 iunie
- **Qatar 1-1 Elveția** — Elveția 26 șuturi → 1 gol.
- **Brazilia 1-1 Maroc** — Under 2.5 ✅, dar Maroc a presat, nu bloc jos.
- **Haiti 0-1 Scoția** — Haiti a tras MAI MULT (15-9!); citirea „Scoția domină" greșită; dar faulturi/cartonașe ✅ (44 faulturi).
- **Australia 2-0 Turcia** — cornere/SoT/parări/Under ✅✅✅✅; „Australia nu marchează" ❌ (Turcia 30 șuturi → 0 goluri și a pierdut).

### 14 iunie
- **Germania 7-1 Curaçao** — cornere 8/1 EXACT, Curaçao SoT 2 EXACT, Havertz/Musiala ✅; subestimat scorul.
- **Olanda 2-2 Japonia** — „echilibrat, ambele marchează" ✅.
- **Coasta Fildeș 1-0 Ecuador** — scor EXACT + Amad marcatorul ✅.
- **Suedia 5-1 Tunisia** — „puține goluri" GREȘIT, dar Gyökeres/Isak ✅.

**Concluzie:** bun la volum + oameni-cheie + meciuri echilibrate; slab la scor exact + goluri.

## Cum primesc date / limite

- Cotele = ca **TEXT** (NU screenshot, NU cale `C:\`). Pozele = **ATAȘATE** în chat (le pot citi).
- NU am acces la Betano. NU văd fișiere locale `C:\`.
- Ideal: tabele ultimele 10 meciuri/echipă (cornere/șuturi/SoT/parări/faulturi/cartonașe + adversari) + log șuturi jucători + lineup-uri.

## Format output / meci

1. Forma jocului
2. Proiecții ✅ ca **intervale**
3. Omul echipei
4. 1 linie scor (marcat „estimare")
5. Bilete scurte cu veriga slabă marcată

## Promoția „1 Goal Up" Betano (14-20 iun)

**Regula:** pariu SIMPLU pre-meci pe piața „Câștigă meciul sau conduce cu 1 gol". **Câștigi pe loc** când echipa ta conduce cu 1 gol (1-0, 2-1, 3-2) în timp regulamentar — **indiferent de scorul final.** (Nu merge la combinate/Bet Builder/Live.)

**Selecții eligibile + clasament:**
- 🟢 **Merită:** Germania (vs CdF, 20 iun), Argentina (vs Algeria, 17 iun), Anglia (vs Croația, 17 iun) — favoriți mari care marchează primii.
- 🟡 **Medii:** Belgia (vs Egipt), Mexic (vs Coreea). Olanda (14 iun, deja — a condus 1-0, ar fi cashuit).
- 🔴 **Risc:** Turcia (vs Paraguay) — acum 2 zile a tras de 30 ori și a pierdut 2-0 fără să conducă. Favorit ≠ conduce.

### Anglia–Croația (17 iun) + „contră" (hedge)

Promo se închide LIVE, contra pe Croația se decide la FINAL → **nu poți pierde ambele.**
- **Contra 1** (poate da 2 winuri, 0 imposibil): `Croația – Șansă dublă X2`. Anglia conduce devreme (promo ✅) + Croația revine (X2 ✅) = 2 winuri.
- **Contra 2** (de regulă 1 win, asigurare strictă): `Croația câștigă (2)`.
- ⚠️ Pro-Anglia (ex. „Anglia câștigă") NU e protecție — poți pierde ambele.

## De făcut în chat nou

1. **Verifică rezultatele de la 15 iun** (Spania–Capul Verde, Belgia–Egipt, Arabia–Uruguay, Iran–NZ) — am dat buildere de 6 legături acolo, ținem scorul sistemului.
2. Pentru promo: verifică **forma/lotul** la Germania/Argentina/Anglia înainte de zilele lor.
