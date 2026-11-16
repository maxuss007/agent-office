# Agent Office

*[English version](README.md)*

Kancelář AI agentů na tvém Macu. Zadáš šéfovi cíl a on si sestaví tým (výzkum, návrh, text, kontrola…), rozdělí práci, nechá ji ověřit a vrátí hotový výsledek jako přehledné HTML stránky. Běží nad tvými **předplatnými** Claude a ChatGPT (Codex), volitelně i Google Antigravity a Gemini. Nepotřebuje žádné API klíče.

- Šéf (Harvey) jede na nejsilnějším dostupném modelu Claude, ostatním agentům vybírá model podle úkolu a podle toho, které předplatné má víc volného limitu.
- Kancelář je vidět jako animovaná scéna, kde agenti sedí u stolů, chodí za šéfem s otázkami a podobně. Vedle ní je rozhovor se šéfem, úkoly a výstupy.
- Když dojde limit, práce se uloží a po obnovení limitu sama pokračuje.
- Rozhraní je anglicky nebo česky: přepínač **EN | CS** vpravo nahoře. Ve stejném jazyce s tebou mluví i šéf.

> Všechno běží lokálně. Server poslouchá jen na `127.0.0.1` a nic se neposílá jinam než do služeb, které připojíš (Claude, OpenAI, Google).

---

## 1. Co potřebuješ

- **macOS 13 Ventura nebo novější**, Apple silicon i Intel (samotný server běží všude, kde je Node).
- **Node.js 20+** (`brew install node`).
- Aspoň jednu službu:

| Služba | Účet | Instalace |
|---|---|---|
| **Claude** (doporučeno, šéf) | Claude Pro nebo Max | `curl -fsSL https://claude.ai/install.sh \| bash` |
| **Codex** | ChatGPT Plus nebo Pro | `npm install -g @openai/codex` nebo `brew install --cask codex` |
| **Antigravity** (volitelné) | účet Google | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` (příkaz `agy`) |
| **Gemini** (volitelné, studium a rešerše) | účet Google nebo `GEMINI_API_KEY` | `npm install -g @google/gemini-cli` nebo `brew install gemini-cli` |

Pro Mac aplikaci navíc **Xcode Command Line Tools** (`xcode-select --install`), kvůli `swiftc`.

## 2. Spuštění

### Stažení

Stáhni `Agent.Office.dmg` z [Releases](../../releases/latest), otevři ho a přetáhni Agent Office do složky Applications. Pak pokračuj podle odstavce o notarizaci níže.

### Sestavení Mac aplikace

```bash
git clone https://github.com/maxuss007/agent-office.git agent-office
cd agent-office
bash mac/build.sh
```

Při první instalaci `mac/build.sh` sám spustí `scripts/setup.sh`: zkontroluje nástroje a nainstaluje pluginy (autoharness, oficiální tržiště). Setup jde pustit i samostatně, `bash scripts/setup.sh --check` jen vypíše, co chybí, a nic neinstaluje. Přeskočíš ho přes `AO_SKIP_SETUP=1 bash mac/build.sh`.

Skript postaví `Agent Office.app`, nainstaluje ji do `/Applications` (nebo `~/Applications`) a spustí ji. `bash mac/build.sh --no-install` aplikaci jen sestaví do `mac/build/`.

Aplikace si sama spouští server. Data ukládá do `~/Library/Application Support/Agent Office/`, projekty do `~/Agent Office/`.

### Instalační balíček (.dmg)

```bash
bash mac/make-dmg.sh
```

Vyrobí `mac/build/Agent Office.dmg`. Po otevření se ukáže okno, ve kterém se Agent Office přetáhne do složky Applications. Při prvním spuštění si aplikace sama zkontroluje nástroje a doinstaluje pluginy (stejně jako `scripts/setup.sh`). Když něco chybí, ukáže co a jak to doinstalovat.

Aplikace není notarizovaná u Apple (to vyžaduje placený vývojářský účet), takže ji macOS na jiném Macu poprvé zablokuje hláškou, že nemůže ověřit, jestli neobsahuje malware. Postup:
1. Zavři hlášku (Hotovo / OK).
2. Otevři **Nastavení systému → Soukromí a zabezpečení**, sjeď dolů a u Agent Office klikni na **Přesto otevřít**, pak potvrď heslem nebo Touch ID.
3. Stačí jednou, další spuštění už projdou.

Jde to i v Terminálu: `xattr -dr com.apple.quarantine "/Applications/Agent Office.app"`. Tenhle příkaz je vidět i v okně DMG a ke zkopírování je v souboru *Terminal command.txt* vedle aplikace.

### Aktualizace

Aplikace si sama hlídá novou verzi na GitHubu. Když je nová, v hlavičce se rozsvítí oranžové tlačítko **Aktualizovat na X.Y.Z**. Po kliknutí se stáhne jen nový server a rozhraní (pár MB), uloží se do `~/Library/Application Support/Agent Office/app/` a aplikace se sama restartuje. Celou aplikaci ani DMG není potřeba stahovat znovu. Když nová verze nenaběhne, aplikace se vrátí ke své vlastní verzi.

Jak vydat novou verzi: jedním příkazem ze složky, ve které vyvíjíš.

```bash
bash scripts/release.sh 1.2.0 "Co je nového"
```

Skript zvýší verzi ve `version.json` a zkopíruje aplikaci do checkoutu veřejného repozitáře (`AO_SHARE_DIR`, výchozí `../agent-office-sdileni/agent-office`). Pak zkontroluje, že v kopii nejsou osobní údaje: cesty k domovské složce, e-mail, tokeny ani názvy tvých projektů. Nakonec spustí testy a pushne na GitHub. Když něco nesedí, nic neodešle. S `--dmg` vydá i nové DMG na GitHub Releases, s `--dry-run` všechno jen vyzkouší.

Když změníš `mac/AgentOffice.swift`, zvyš v něm `shellVersion` a vydej s `--shell`. Tuhle část přes aktualizaci vyměnit nejde, takže aplikace místo stahování nabídne odkaz na nové DMG (`Releases → latest` na GitHubu).

### Jen server (bez aplikace)

```bash
node server.mjs
```

Otevři adresu, kterou vypíše (`http://localhost:4747/?t=<token>`). Token se vytvoří při prvním startu v `config.json`.

## 3. Připojení služeb

V aplikaci klikni vpravo nahoře na **Připojení**. U každé služby je rozbalovací **„Jak připojit“** s kroky, stav připojení a zbývající limity (5hodinový a týdenní).

**Claude**
1. Nainstaluj Claude Code (viz tabulka).
2. Klikni na **Připojit znovu**. Otevře se Terminál s `claude auth login`, kde se přihlásíš.
3. Aby přihlášení nevypršelo, spusť v Terminálu `claude setup-token` a token vlož do pole **Trvalý token**. Uloží se jen do Klíčenky tvého Macu.

**Codex**
1. Nainstaluj Codex (viz tabulka), případně stačí aplikace ChatGPT nebo Codex pro Mac.
2. Klikni na **Připojit znovu** (`codex login`) a přihlas se účtem ChatGPT.

**Antigravity (volitelné)**
1. Nainstaluj Antigravity CLI (příkaz `agy`, viz tabulka).
2. Klikni na **Připojit znovu**. V Terminálu se spustí `agy` a v prohlížeči se přihlásíš účtem Google. Přihlášení se uloží do Klíčenky.
3. Když je připojený, šéf mu sám dává programování, hlavně když Codex chybí nebo mu dochází limit. U agenta ho můžeš zvolit i ručně: klikneš na postavu a vybereš **Model**. Smí upravovat soubory, příkazy v Terminálu ne.

**Gemini (volitelné)**: přímý přístup ke Gemini, hodí se na studium, vysvětlování a rešerše.
1. Nainstaluj Gemini CLI (viz tabulka).
2. Klikni na **Připojit znovu**. V Terminálu se spustí `gemini` a přihlásíš se účtem Google, případně nastav `GEMINI_API_KEY`.
3. Když je připojené, šéf mu sám dává studium a rešerše. U agenta ho můžeš zvolit i ručně.

Antigravity a Gemini jsou dvě různé cesty ke Gemini modelům: Antigravity je agent zaměřený na práci s kódem a soubory, Gemini CLI je přímý chat s modelem s vyhledáváním Google. V okně Připojení najdeš Antigravity jako podsekci karty Gemini.

Agent Office si nikdy neukládá hesla. Každá služba používá vlastní přihlášení na tvém Macu. Do podprocesů se nepředávají žádné API klíče Anthropic ani OpenAI z prostředí.

## 4. Jak se to používá

1. Na stránce **Projekty** klikni na **Nový projekt** (vznikne složka a git repozitář) nebo připoj existující složku.
2. V projektu napiš šéfovi cíl. **Nový cíl** nabízí typ práce, důkladnost a podklady.
3. Šéf si udělá rešerši, kritéria a plán, rozdělí úkoly a nechá je ověřit. Ptá se jen na nejnutnější věci, nanejvýš na 3 otázky s tlačítky.
4. Průběh sleduješ v kanceláři (přepínač **Kancelář | Tým**), v úkolech a v rozhovoru se šéfem. Klikem na postavu otevřeš detail agenta: co dělá, jaký model používá, lidské shrnutí a chat.
5. Výsledky najdeš vpravo ve **Výstupech**, hlavní je `Souhrn zakázky`. Projekt jde pozastavit, zastavit, převzít nebo otevřít v Codexu či Claude Code.

## 5. Jak orchestrace pracuje

- **„Hotovo“ znamená ověřená povinná kritéria.** Šéf před prací napíše `SCORECARD.md` (MUST/SHOULD/NICE). Hotovo je jen tehdy, když každé MUST má doložený PASS. Jinak je projekt *Rozpracovaný* se seznamem mezer.
- **Tabule úkolů** (`office/BOARD.md`) se zámky, **předávky s důkazy** (`office/handoffs/`), **log rozhodnutí** (`office/DECISIONS.md`).
- **Pokračování:** po chybě, restartu nebo vyčerpaném limitu práce naváže na poslední ověřený stav.
- **Úspora tokenů:** každý agent dostane jen nástroje a skills svého úkolu. Výpočty a testy jdou příkazem bez modelu a závěrečnou zprávu skládá kód.
- **Spotřeba:** každé volání se zapisuje do `projects/<id>/attempts.jsonl`. Tabulka je v **Průběh a spotřeba**.
- **Bezpečnost:** práce běží ve vlastní git větvi `office/<id>` v samostatném worktree, nic se nepushuje a Bash mají agenti jen přes allowlist.

Instrukce šéfa jsou v `boss.md`, role v `roles/*.md`, společná pravidla v `roles/_contract.md` a presety v `presets/`.

## 6. Skills a autoharness

- Agenti (Claude i Codex) smí používat tvoje nainstalované skills. Codex čte `~/.agents/skills`. Agent Office tam symlinkem zpřístupní skills z `~/.claude/skills` a nic nemaže.
- Šéf vidí katalog skills a pluginů a přiděluje je k úkolům. Oficiální pluginy si umí nainstalovat sám, komunitní jen po tvém potvrzení.
- Plugin **autoharness** se učí nové skills z odvedené práce. Nainstaluje ho `scripts/setup.sh`, případně ručně:
  ```bash
  claude plugin marketplace add tigerless-labs/autoharness
  claude plugin install autoharness@autoharness --scope user
  ```
  Potřebuje Python 3.11+ jako `python3`.
- Šéf si sám instaluje pluginy z oficiálního tržiště `anthropics/claude-plugins-official`. To přidá také `scripts/setup.sh`.
- Složka `.claude/skills/` obsahuje skills pro vývoj samotné aplikace (scéna, UI, limity, reinstalace). Claude Code je použije při úpravách tohoto repozitáře.

## 7. Kancelář a grafika

Scéna je v `public/office-suits.js`, grafika v `public/assets/suits/`:
- `office.png`: kancelář (Harveyho pracovna s lavicemi pro hosty, Donnina recepce, 24 stolů),
- `stand/` a `walk/`: postavy stojící a dvě fáze kroku,
- `seat/`: postavy sedící u stolu zády k nám,
- `front/`: Harvey a Donna sedící čelem (klid, otázka, psaní),
- `face/`: výřezy obličejů pro seznam týmu.

Kdo pracuje, sedí u stolu. Kdo nic nedělá, čeká nebo má hotovo, stojí u židle. Kdo je zaseknutý, dojde za Harveym a sedne si na lavici. Postavy jsou inspirované seriálem Suits.

## 8. Vývoj

```bash
node --test tests/          # testy (nespotřebovávají předplatné, používají falešná CLI)
```

Struktura: `server.mjs` (HTTP + SSE) · `public/i18n.js` (angličtina a čeština v rozhraní) · `updater.mjs` (aktualizace z GitHubu, `version.json`) · `orchestrator.mjs` (šéf, plán, úkoly, ověření) · `providers.mjs` (Claude, Codex, Antigravity, Gemini, limity, výběr modelu) · `report.mjs` (HTML výstupy) · `public/` (UI) · `mac/` (Mac aplikace).

### Volitelné

- **Telefon:** `HOST=0.0.0.0 node server.mjs` vypíše adresu pro telefon ve stejné wifi. Token v odkazu je jediná ochrana, port nevystavuj do internetu.
- **Push notifikace přes ntfy:** do `config.json` přidej `{ "ntfyTopic": "tvuj-tajny-topic" }`. Text otázek šéfa pak jde přes veřejnou službu ntfy.sh.

## 9. Poděkování

Agent Office stojí na práci jiných lidí. Díky jim:

**Nástroje, na kterých běží**
- [Claude Code](https://claude.com/claude-code) a tržiště [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) od Anthropic.
- [Codex](https://github.com/openai/codex) od OpenAI.
- [Antigravity](https://antigravity.google) a [Gemini CLI](https://github.com/google-gemini/gemini-cli) od Google.
- [autoharness](https://github.com/tigerless-labs/autoharness) od Tigerless Labs: plugin, který z odvedené práce učí nové skills (vznikly z něj i skills v `.claude/skills/`).
- [Skills CLI](https://github.com/vercel-labs/skills) od Vercel Labs pro hledání a instalaci skills.

**Skills, se kterými agenti v kanceláři rádi pracují** (nejsou součástí tohoto repozitáře, instalují se zvlášť)
- SEO a reklama: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) a [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads).
- Design, značka a prezentace: ClaudeKit (`design`, `brand`, `design-system`, `ui-styling`, `banner-design`, `slides`).
- Design a animace: principy [Emila Kowalskiho](https://emilkowal.ski).
- Marketing: skills vycházejí mimo jiné z knihy *Founding Marketing* od Coreyho Hainese.
- Viditelnost v AI vyhledávání: [Knowatoa/ai-visibility-skills](https://github.com/Knowatoa/ai-visibility-skills).
- Rada modelů: [karpathy/llm-council](https://github.com/karpathy/llm-council) od Andreje Karpathyho, skill podle [aiwithremy/claude-skills-llm-council](https://github.com/aiwithremy/claude-skills-llm-council).
- Blender: blender-agent-skills. BIM a Bonsai: [OpenAEC Foundation](https://github.com/OpenAEC-Foundation). ArchiCAD: weltmaister.

**Grafika**
- Postavy jsou fanouškovská pocta seriálu *Suits* (autor Aaron Korsh, USA Network). Projekt s tvůrci seriálu nijak nesouvisí a jména i podoby postav patří jejich vlastníkům.
- Kancelář a postavy byly vygenerované v Codexu.

Pokud tu někdo chybí nebo je uvedený špatně, dej vědět přes issue.
