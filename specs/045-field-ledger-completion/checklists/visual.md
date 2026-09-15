# Visual acceptance: Field & Ledger completion

**Purpose**: the one criterion a person must sign. Every other check in this
feature is automated; this is the one that asks whether the room *looks like the
design*, which no assertion can answer.

**How**: open each baseline in `tests/integration/ui/room-fixtures.spec.ts-snapshots/`
beside its figure in `Wottle UX Audit.dc.html`, or run `pnpm dev` and open
`/dev/room?phase=…` at the stated size. Tick, or note what differs.

**Compared by**: _________________  **Date**: _________________

---

## Fig. 2 — match, 1440×900 (`match-visual-1440x900`)

- [ ] Bars 60px, `1fr auto 1fr`; the 12px seat square aligns with the field's frame
- [ ] Clock 26px mono — ink 500 while running, muted 400 when stopped
- [ ] Total 40px in the seat colour; lane 4px on the bar's inner edge
- [ ] Field on paper, 1px rules crossing the bands, 1.5px ink frame
- [ ] Letters 55% of the cell; value numerals top-right
- [ ] Bands 14% tint with **one** 1.5px chevron at each word's reading start
- [ ] A letter in two words renders ink 700 (the `L` of `LEK`/`GILT` at 7,6)
- [ ] Ledger: caption, seat header, ten rows sharing the height, full-width live
      row with its 3px rule at the left, territory, hint, foot
- [ ] Ledger's top rule and foot align with the bars' outer edges
- [ ] One gutter of 56px between field and ledger; the pair centred
- [ ] Nothing is drawn over the field

## Fig. 5 — phone, 390×844 (`match-visual-390x844`)

- [ ] bar 56 / field 358 / bar 56 / live row, and the page does not scroll
- [ ] Letters still 55% of a 35px cell; numerals present and legible
- [ ] Live row reads the live state left, `history ▸` right
- [ ] Opening it puts the sheet **below the bottom bar**, never over the field
- [ ] The sheet scrolls inside itself; the page still does not scroll

## Fig. 6 — lobby (`lobby-visual-1440x900`, `lobby-visual-390x844`)

- [ ] `No opponent yet` top bar with `play ranked ▸`
- [ ] Warm-up field, full grid
- [ ] `here now` and `your last matches` tables; copy reads
      `challenge for an unranked match`
- [ ] On the phone the directory is **visible**, not folded behind `history ▸`

## Fig. 7 — queue and found (`queue-*`, `found-*`)

- [ ] `Finding an opponent` with the travelling 12% lane segment
- [ ] Live row reads `setting the field · n of 100 letters`
- [ ] Found: the opponent's name written into the top bar, `round 1 in 3`

## Fig. 8 — final (`final-visual-1440x900`)

- [ ] Verdict block above the seat header, stated once
- [ ] Rating lines in both bars
- [ ] Foot reads `rematch ▸ · new opponent ▸ · lobby`

## Fig. 9 — profile (`profile-visual-1440x900`)

- [ ] 14px seat square, 28px name, 48px rating
- [ ] Hairline chart with **unstretched** axis labels

## Fig. 10 — states (`landing-*`, `disconnect-*`)

- [ ] Landing: the name input sits in the bottom bar, opponent seat empty
- [ ] Disconnect: dashed lane in the 6px/4px pattern, `reconnecting · 0:42 left`

---

## Notes and exceptions

_Record anything that differs from its figure, and whether it is accepted._
