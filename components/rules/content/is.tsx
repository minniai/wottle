import { RulesFigure } from "@/components/rules/RulesFigure";
import { ScoringTable } from "@/components/rules/ScoringTable";

import type { RulesContentProps } from "./types";

/** Reglurnar á íslensku (spec 060): sömu sex kaflar, sömu þrjár myndir og stigataflan. */
export function RulesIs({ clock, totalMoves, copy }: RulesContentProps) {
  return (
    <>
      <div className="rules__lede">
        <span className="rules__label">svona er spilað</span>
        <h1 className="rules__title">Tveir leikmenn, eitt borð, tíu leikir hvor.</h1>
        <p>
          Orðusta er orðaeinvígi á 10×10 borði af íslenskum stöfum. Báðir leikmenn leika þegar þeim hentar, á einni
          klukku. Sá sem les borðið betur, og nýtir klukkuna betur, vinnur.
        </p>
      </div>

      <section className="rules__section" id="the-move">
        <div>
          <span className="rules__label">1 · leikurinn</span>
          <h2>Skiptu á tveimur stöfum.</h2>
          <p>
            Veldu einn staf, svo annan. Þeir skipta um sæti. Það er einn leikur; þú átt tíu og leikur þeim þegar þér
            hentar. Hver leikur er reiknaður um leið og hann berst og næsti leikur opnast um leið og þú hefur séð stigin.
          </p>
          <p>
            Frosinn staf má ekki færa. Leikir eru reiknaðir í þeirri röð sem þeir berast þjóninum. Ef andstæðingurinn
            frysti eða færði annan stafinn þinn rétt áður en leikurinn þinn barst er honum hafnað og þú velur aftur; hann
            telst ekki einn af tíu.
          </p>
        </div>
        <RulesFigure kind="swap" caption="tveimur stöfum skipt: einn leikur af tíu" />
      </section>

      <section className="rules__section" id="words">
        <div>
          <span className="rules__label">2 · orð</span>
          <h2>Þrír stafir eða fleiri, í beinni línu.</h2>
          <p>
            Eftir hvert skipti er borðið lesið lárétt og lóðrétt út frá stöfunum tveimur sem færðust. Hver ný röð þriggja
            stafa eða fleiri sem er íslenskt orð gefur þeim stig sem skiptin gerði. Allar beygingarmyndir gilda, og orð
            gefur stig aftur ef þú myndar það á nýjum stað.
          </p>
          <p>Orð er dregið sem band í lit þess sem skoraði, með ör þar sem lesturinn hefst.</p>
        </div>
        <RulesFigure kind="words" caption="BORÐ lesið lárétt, GILT lesið lóðrétt; örin sýnir hvar hvort hefst" />
      </section>

      <section className="rules__section" id="freezing">
        <div>
          <span className="rules__label">3 · frost</span>
          <h2>Stafir sem skora frjósa í þínum lit.</h2>
          <p>
            Allir stafir orðs sem skorar frjósa. Frosnum stöfum getur enginn skipt aftur, svo hvert orð sem þú skorar tekur
            líka svæði af andstæðingnum. Þar sem orð sker orð sem þegar hefur skorað heldur sameiginlegi stafurinn lit
            þess sem frysti hann fyrst.
          </p>
          <p>Á borðinu eru alltaf að minnsta kosti 24 lausir stafir.</p>
        </div>
        <RulesFigure kind="crossing" caption="LEK sker GILT; L-ið heldur lit andstæðingsins" />
      </section>

      <section className="rules__section" id="scoring">
        <div>
          <span className="rules__label">4 · stig</span>
          <h2>Gildi og lengd.</h2>
          <ScoringTable copy={copy} />
          <p>Heildarstigin þín standa á þínu spjaldi og telja upp um leið og hvert band lendir.</p>
        </div>
      </section>

      <section className="rules__section" id="the-clock">
        <div>
          <span className="rules__label">5 · klukkan</span>
          <h2>Fimm mínútur fyrir alla viðureignina.</h2>
          <p>
            Ein klukka, {clock}, fyrir báða leikmenn, efst í leikskránni. Hún fer af stað þegar viðureignin hefst og stöðvast
            aldrei, hvorki meðan þú bíður eftir stigum né meðan einhver er fjarverandi. Undir 1:00 blikkar hún. Leikur sem
            berst þjóninum fyrir 0:00 gildir, jafnvel þótt stigin birtist eftir það.
          </p>
          <p>
            Spjaldið þitt telur niður {totalMoves} leikina þína: tíu merki á brúninni, eitt tæmist fyrir hvern leik.
            Spjald andstæðingsins telur hans.
          </p>
        </div>
      </section>

      <section className="rules__section" id="winning">
        <div>
          <span className="rules__label">6 · sigur</span>
          <h2>Flest stig vinna.</h2>
          <p>
            Viðureigninni lýkur þegar báðir hafa leikið öllum tíu leikjunum, eða þegar klukkan rennur út. Renni klukkan út
            fyrst telst hver leikur sem þú lékst ekki sem leikur án orðs og kostar −5. Þá vinnur hærri heildartalan; sé
            jafnt vinnur sá sem á fleiri frosna stafi; sé allt jafnt er jafntefli. Heildartalan getur farið undir núll.
            Allar viðureignir gilda til Elo-stiga: stigin þín breytast um leið og viðureigninni lýkur og nýju stig beggja
            standa á úrslitunum.
          </p>
        </div>
      </section>
    </>
  );
}
