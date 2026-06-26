import { knockoutFormatLabel, pointSystemInfo, qualificationInfo, setFormatLabel } from '@/lib/tournament/ruleLabels'

type Config = {
  numGroups?: number | null
  advancePerGroup?: number | null
  advanceTotal?: number | null
  advanceMode?: string | null
  groupSetFormat?: string | null
  groupTiebreakPoints?: number | null
  groupTimeMinutes?: number | null
  groupCourts?: number | null
  groupPointSystem?: string | null
  groupBreakMinutes?: number | null
  drawMethod?: string | null
  numSeeds?: number | null
  clubRule?: boolean | null
  knockoutFormat?: string | null
  knockoutSetFormat?: string | null
  knockoutTiebreakPoints?: number | null
  knockoutTimeMinutes?: number | null
  knockoutCourts?: number | null
  thirdPlaceMatch?: boolean | null
  groupStartsAt?: Date | string | null
  knockoutStartsAt?: Date | string | null
}

const DRAW_LABELS: Record<string, string> = {
  RANDOM: 'Atsitiktinis (sėjamosios atskirai)',
  SEEDED_RANDOM: 'Sėjamosios pagal reitingą',
  SNAKE: 'Gyvatėlė pagal reitingą',
  MANUAL: 'Rankinis',
}

export default function TournamentRulesGuide({ config }: { config?: Config | null }) {
  const qualification = qualificationInfo({
    numGroups: config?.numGroups,
    advanceMode: config?.advanceMode,
    advancePerGroup: config?.advancePerGroup,
    advanceTotal: config?.advanceTotal,
  })

  return (
    <article className="mx-auto max-w-5xl text-gray-700">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-xs font-semibold uppercase text-gray-400">Turnyro žinynas</p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-950 sm:text-3xl">Nustatymai, rikiavimas ir patekimas į atkrintamąsias</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Čia aprašyta faktinė programos logika: ką reiškia kiekvienas nustatymas, kaip sprendžiamos lygiosios grupėje ir kaip sudaromas bendras atkrintamųjų komandų reitingas.
        </p>
        <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Aprašymo skyriai">
          <a href="#nustatymai" className="rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">Nustatymai</a>
          <a href="#grupiu-rikiavimas" className="rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">Grupių rikiavimas</a>
          <a href="#atranka" className="rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">Atranka į atkrintamąsias</a>
        </nav>
      </header>

      {config && (
        <section className="border-b border-gray-200 py-6" aria-labelledby="current-rules">
          <h2 id="current-rules" className="text-lg font-semibold text-gray-950">Dabartinis turnyras</h2>
          <div className="mt-4 grid overflow-hidden rounded-lg border border-gray-200 bg-white sm:grid-cols-2">
            <CurrentBlock
              title="Grupių etapas"
              lines={[
                `${config.numGroups ?? '—'} grupės`,
                setFormatLabel(config.groupSetFormat),
                pointSystemInfo(config.groupPointSystem).label,
                `${qualification.count} komandų patenka į atkrintamąsias`,
              ]}
            />
            <CurrentBlock
              title="Atkrintamosios"
              lines={[
                knockoutFormatLabel(config.knockoutFormat),
                setFormatLabel(config.knockoutSetFormat),
                `Tie-break iki ${config.knockoutTiebreakPoints ?? 15} taškų`,
                config.thirdPlaceMatch === false ? 'Be rungtynių dėl 3 vietos' : 'Su rungtynėmis dėl 3 vietos',
              ]}
            />
          </div>
        </section>
      )}

      <section id="nustatymai" className="scroll-mt-6 border-b border-gray-200 py-8">
        <h2 className="text-xl font-semibold text-gray-950">Galimi nustatymai</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">Skaitinės ribos nurodytos pagal programoje taikomą validaciją.</p>

        <SettingsGroup title="Grupių etapas">
          <SettingRow name="Grupių skaičius" values="1–32" current={config?.numGroups}>
            Nurodo, į kiek grupių bus paskirstytos komandos. Burtai stengiasi išlaikyti vienodą grupių dydį; kai komandos nesidalija po lygiai, grupių dydžiai gali skirtis viena komanda.
          </SettingRow>
          <SettingRow name="Patekimo režimas" values="Fiksuotas iš grupės | Iš viso + geriausios" current={config?.advanceMode === 'total' ? 'Iš viso + geriausios' : 'Fiksuotas iš grupės'}>
            Fiksuotu režimu iš kiekvienos grupės patenka vienodas nustatytas komandų skaičius. Bendro skaičiaus režimu pirmiausia garantuojamos vietos iš kiekvienos grupės, o likusios vietos skiriamos geriausioms kitos pozicijos komandoms.
          </SettingRow>
          <SettingRow name="Garantuojama iš grupės" values="1–20" current={config?.advancePerGroup}>
            Kiek aukščiausių vietų kiekvienoje grupėje patenka tiesiogiai. Šis skaičius taip pat nustato, nuo kurios kitos vietos pradedama „wild card“ atranka.
          </SettingRow>
          <SettingRow name="Iš viso patenka" values="2–128 (naudojama bendro skaičiaus režime)" current={config?.advanceMode === 'total' ? config.advanceTotal : undefined}>
            Galutinis atkrintamųjų dalyvių skaičius. Jis negali būti mažesnis už tiesioginių vietų skaičių: grupių skaičius × garantuojamos vietos.
          </SettingRow>
          <SettingRow name="Setų formatas" values="Best of 2 iki 21 | Best of 2 iki 15 | 1 setas iki 21 | 1 setas iki 15" current={config ? setFormatLabel(config.groupSetFormat) : undefined}>
            „Best of 2“ reiškia du pagrindinius setus. Jei po jų yra 1:1, žaidžiamas lemiamas tie-break, todėl galutinis rezultatas būna 2:0 arba 2:1. Vieno seto formate rungtynes lemia vienas setas.
          </SettingRow>
          <SettingRow name="Tie-break iki" values="11 arba 15 taškų" current={config?.groupTiebreakPoints}>
            Taikoma tik tada, kai „Best of 2“ rungtynėse pagrindiniai setai pasidalijami 1:1.
          </SettingRow>
          <SettingRow name="Laimėjimo sistema" values="2/1 | 3/2/1/0 | 1/0 | Taškas už laimėtą setą" current={config ? pointSystemInfo(config.groupPointSystem).label : undefined}>
            <strong>2/1:</strong> nugalėtoja gauna 2 turnyrinius taškus, pralaimėjusi – 1. <strong>3/2/1/0:</strong> 2:0 pergalė verta 3 taškų, 2:1 pergalė – 2, 1:2 pralaimėjimas – 1, 0:2 pralaimėjimas – 0; šis variantas galimas tik „Best of 2“ grupių rungtynėms. <strong>1/0:</strong> nugalėtoja gauna 1, pralaimėjusi – 0. <strong>Taškas už setą:</strong> turnyrinių taškų skaičius lygus laimėtų setų skaičiui, įskaitant tie-break.
          </SettingRow>
          <SettingRow name="Burtų metodas" values="Atsitiktinis | Sėjamosios pagal reitingą | Gyvatėlė | Rankinis" current={config?.drawMethod ? DRAW_LABELS[config.drawMethod] : undefined}>
            Atsitiktiniame metode sėjamosios tolygiai paskirstomos, o jų ir kitų komandų vietos atsitiktinamos. „Sėjamosios pagal reitingą“ pirmiausia išdėsto sėjamąsias pagal reitingą, likusias komandas traukia atsitiktinai. Gyvatėlė visas komandas dėlioja reitingo seka pirmyn ir atgal per grupes. Rankinis metodas sukuria pradinį atsitiktinį paskirstymą, kurį administratorius gali koreguoti.
          </SettingRow>
          <SettingRow name="Sėjamųjų skaičius" values="0 arba daugiau (kuriant turnyrą)" current={config?.numSeeds}>
            Šis kuriant turnyrą išsaugomas skaičius pats komandų sėjamosiomis nepažymi. Faktinės sėjamosios parenkamos komandų puslapyje žvaigždute; būtent taip pažymėtos komandos burtuose paskirstomos kuo tolygiau. Sėjamųjų balansas yra aukštesnis prioritetas už klubo apribojimą.
          </SettingRow>
          <SettingRow name="Klubo apribojimas" values="Įjungtas | Išjungtas" current={config ? (config.clubRule ? 'Įjungtas' : 'Išjungtas') : undefined}>
            Kai įjungtas, tos pačios klubo komandos – įskaitant sėjamąsias – dedamos į skirtingas grupes. Jei to padaryti neįmanoma, programa pirmiausia išlaiko sėjamųjų balansą ir grupių dydžių balansą, o klubo apribojimą konkrečiai komandai gali atleisti.
          </SettingRow>
          <SettingRow name="Rungtynių trukmė" values="15–180 min." current={config?.groupTimeMinutes ? `${config.groupTimeMinutes} min.` : undefined}>
            Naudojama automatiniam tvarkaraščio laiko žingsniui apskaičiuoti.
          </SettingRow>
          <SettingRow name="Aikštelių skaičius" values="1–20" current={config?.groupCourts}>
            Kiek rungtynių vienu metu gali būti suplanuota skirtingose aikštelėse.
          </SettingRow>
          <SettingRow name="Grupių pradžia ir pertrauka" values="Pradžios laikas; 0–60 min. pertrauka" current={config?.groupBreakMinutes !== null && config?.groupBreakMinutes !== undefined ? `${config.groupBreakMinutes} min. pertrauka` : undefined}>
            Pradžios laikas nustato pirmą grupių rungtynių laiką. Po rungtynių jų trukmė ir nustatyta pertrauka užblokuoja tiek abi žaidusias komandas, tiek naudotą aikštelę; kitos rungtynės joms ar toje aikštelėje planuojamos tik po šio intervalo.
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title="Atkrintamosios">
          <SettingRow name="Sistema" values="Vieno minuso | FIVB Lucky Loser | Dviejų minusų | Apskritasis" current={config ? knockoutFormatLabel(config.knockoutFormat) : undefined}>
            <strong>Vieno minuso:</strong> pralaimėjusi komanda iškrenta. <strong>Lucky Loser:</strong> tiesioginės komandos patenka į pagrindinį tinklelį, o žemesnių pozicijų komandos pirmiausia varžosi Lucky Loser etape dėl likusių vietų. <strong>Dviejų minusų:</strong> po pirmo pralaimėjimo komanda pereina į pralaimėtojų pusę ir iškrenta po antro; naudojama 8 arba 16 vietų schema, daugiausia 16 komandų. <strong>Apskritasis:</strong> viena finalinė grupė, kurioje visos patekusios komandos žaidžia tarpusavyje.
          </SettingRow>
          <SettingRow name="Setų formatas" values="Best of 2 iki 21 | Best of 2 iki 15 | 1 setas iki 21 | 1 setas iki 15" current={config ? setFormatLabel(config.knockoutSetFormat) : undefined}>
            Galioja atkrintamųjų rungtynėms. „Best of 2“ lygybės 1:1 atveju užbaigiamas tie-break setu.
          </SettingRow>
          <SettingRow name="Tie-break iki" values="11 arba 15 taškų" current={config?.knockoutTiebreakPoints}>
            Lemiamo seto taškų riba atkrintamosiose.
          </SettingRow>
          <SettingRow name="Rungtynių trukmė" values="15–180 min." current={config?.knockoutTimeMinutes ? `${config.knockoutTimeMinutes} min.` : undefined}>
            Naudojama generuojant KO tvarkaraščio laiko intervalus.
          </SettingRow>
          <SettingRow name="Aikštelių skaičius" values="1–20" current={config?.knockoutCourts}>
            Didžiausias vienu metu planuojamų KO rungtynių skaičius.
          </SettingRow>
          <SettingRow name="Rungtynės dėl 3 vietos" values="Taip | Ne" current={config ? (config.thirdPlaceMatch === false ? 'Ne' : 'Taip') : undefined}>
            Kai įjungta, sukuriamos atskiros rungtynės dėl trečios vietos. Dalyviai parenkami pagal naudojamos sistemos kelią.
          </SettingRow>
          <SettingRow name="Atkrintamųjų pradžia" values="Data ir laikas">
            Jei grupių tvarkaraštyje yra suplanuotų rungtynių, automatinė KO pradžia nustatoma po paskutinių grupių rungtynių: pridedama jų trukmė ir 30 minučių, tada laikas apvalinamas iki artimiausio ketvirčio valandos. Jei grupių tvarkaraščio nėra, naudojama išsaugota KO pradžia, o jos nesant – turnyro dienos 15:00.
          </SettingRow>
        </SettingsGroup>
      </section>

      <section id="grupiu-rikiavimas" className="scroll-mt-6 border-b border-gray-200 py-8">
        <h2 className="text-xl font-semibold text-gray-950">Kaip rikiuojamos komandos grupėje</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">Visada pirmiausia lyginamas turnyrinių taškų skaičius. Toliau taikoma skirtinga tvarka pagal tai, kiek komandų turi tiek pat taškų.</p>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <OrderList
            title="Kai vienodai taškų turi tik 2 komandos"
            items={[
              'Tarpusavio rungtynių nugalėtoja.',
              'Didesnis bendras laimėtų rungtynių skaičius, jei tarpusavio rezultato dar nėra.',
              'Geresnis setų santykis: laimėti setai ÷ pralaimėti setai.',
              'Geresnis žaidimo taškų santykis: laimėti taškai ÷ pralaimėti taškai.',
              'Didesnis žaidimo taškų skirtumas: laimėti taškai − pralaimėti taškai.',
            ]}
          />
          <OrderList
            title="Kai vienodai taškų turi 3 ar daugiau komandų"
            items={[
              'Didesnis bendras laimėtų rungtynių skaičius.',
              'Geresnis setų santykis: laimėti setai ÷ pralaimėti setai.',
              'Geresnis žaidimo taškų santykis: laimėti taškai ÷ pralaimėti taškai.',
              'Didesnis žaidimo taškų skirtumas: laimėti taškai − pralaimėti taškai.',
            ]}
          />
        </div>

        <div className="mt-6 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Trijų ar daugiau komandų lygybės atveju atskira tarpusavio mini lentelė nekuriama – taikomi bendri visos grupės rodikliai. Jei visi išvardyti kriterijai sutampa, programa išlaiko esamą komandų įrašo eilę.
        </div>

        <div className="mt-6 text-sm leading-6 text-gray-600">
          <p><strong>Setų statistika</strong> apima visus setus, įskaitant tie-break. <strong>Žaidimo taškų santykiui ir skirtumui</strong> naudojami pagrindinių setų taškai; tie-break taškai į šiuos du rodiklius neįtraukiami. Jei komanda nepralaimėjo nė vieno seto, jos setų santykis laikomas aukščiausiu.</p>
        </div>
      </section>

      <section id="atranka" className="scroll-mt-6 py-8">
        <h2 className="text-xl font-semibold text-gray-950">Kaip atrenkamos ir reitinguojamos atkrintamųjų komandos</h2>

        <OrderList
          className="mt-6"
          title="Bendro reitingo sudarymas"
          items={[
            'Kiekvienoje grupėje komandos pirmiausia surikiuojamos pagal aukščiau aprašytas grupės taisykles.',
            'Į bendrą sąrašą pirmiausia sudedamos visų grupių 1 vietos komandos, tada visų grupių 2 vietos komandos, po jų – 3 vietos ir t. t.',
            'Tos pačios vietos komandos iš skirtingų grupių palyginamos pagal statistiką. Tarpusavio rungtynių kriterijus čia netaikomas, nes jos žaidė skirtingose grupėse.',
            'Pagal gautą eilę suteikiami atkrintamųjų reitingai (seed): 1, 2, 3 ir t. t.',
            'Vieno ir dviejų minusų tinkleliuose poros sudaromos standartiniu aukšto–žemo reitingo principu: aukščiausi reitingai atskiriami taip, kad galėtų susitikti kuo vėliau.',
          ]}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <OrderList
            title="Tos pačios vietos komandų palyginimas"
            items={config?.groupPointSystem === 'SET_RATIO' ? [
              'Geresnis setų santykis.',
              'Geresnis žaidimo taškų santykis.',
              'Didesnis žaidimo taškų skirtumas.',
              'Grupės raidė abėcėlės tvarka, jei viskas sutampa.',
            ] : [
              'Daugiau turnyrinių taškų.',
              'Daugiau laimėtų rungtynių.',
              'Geresnis setų santykis.',
              'Geresnis žaidimo taškų santykis.',
              'Grupės raidė abėcėlės tvarka, jei viskas sutampa.',
            ]}
          />
          <div>
            <h3 className="text-base font-semibold text-gray-900">„Wild card“ vietos</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Bendro skaičiaus režime tiesioginės vietos jau būna užpildytos. Į likusias vietas lyginamos komandos, užėmusios pirmą vietą iškart po garantuojamų pozicijų. Pavyzdžiui, jei garantuojamos 3 vietos iš grupės, „wild card“ kandidatės yra 4 vietos komandos.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Įprastose taškų sistemose jos rikiuojamos pagal koreguotus turnyrinius taškus, setų santykį ir žaidimo taškų santykį. Kai pasirinktas „Taškas už laimėtą setą“, pirmas kriterijus yra koreguotas setų santykis, po jo – žaidimo taškų santykis.
            </p>
          </div>
        </div>

        <div className="mt-6 border-l-4 border-blue-400 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          Jei grupės nevienodo dydžio, „wild card“ palyginimui didesnės grupės statistika perskaičiuojama atmetant rezultatus prieš tas žemiausias komandas, kurių mažesnėje grupėje apskritai nėra. Pavyzdžiui, lyginant 6 ir 5 komandų grupes, didesnėje grupėje neįskaitomas rezultatas prieš 6 vietos komandą.
        </div>

        <div className="mt-8">
          <h3 className="text-base font-semibold text-gray-900">Sistemų įtaka atrankai</h3>
          <dl className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
            <Definition term="Vieno minuso ir dviejų minusų">Naudojamas bendras reitingas ir standartinis sėjimas. Dviejų minusų sistema pasirenka 8 vietų schemą, kai komandų iki 8, arba 16 vietų schemą, kai komandų 9–16; tušti lapeliai lieka schemoje kaip nežaidžiamos vietos.</Definition>
            <Definition term="Lucky Loser">Garantinių pozicijų komandos patenka tiesiogiai. Kitos pozicijos rikiuojamos po vieną pozicijų sluoksnį ir, kai reikia, žaidžia Lucky Loser etapą. Jo laimėtojos užpildo likusias pagrindinio tinklelio vietas.</Definition>
            <Definition term="Apskritasis">Visos atrinktos komandos patenka į vieną finalinę grupę ir žaidžia „visi su visais“; iškritimo tinklelis nekuriamas.</Definition>
          </dl>
        </div>
      </section>
    </article>
  )
}

function CurrentBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="border-b border-gray-200 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-500">
        {lines.map(line => <li key={line}>{line}</li>)}
      </ul>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <dl className="mt-3 divide-y divide-gray-200 border-y border-gray-200">{children}</dl>
    </div>
  )
}

function SettingRow({ name, values, current, children }: { name: string; values: string; current?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[190px_1fr] sm:gap-6">
      <dt className="text-sm font-semibold text-gray-900">{name}</dt>
      <dd>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{values}</span>
          {current !== undefined && current !== null && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Dabar: {current}</span>}
        </div>
        <p className="mt-1 text-sm leading-6 text-gray-500">{children}</p>
      </dd>
    </div>
  )
}

function OrderList({ title, items, className = '' }: { title: string; items: string[]; className?: string }) {
  return (
    <div className={className}>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-gray-600">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[190px_1fr] sm:gap-6">
      <dt className="text-sm font-semibold text-gray-900">{term}</dt>
      <dd className="text-sm leading-6 text-gray-600">{children}</dd>
    </div>
  )
}
