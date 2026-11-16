// Agent Office UI language. English is the default; Czech can be chosen in the header (EN | CS).
// The page and the server are written in Czech. In English mode this layer translates what is visible:
// text nodes, placeholder/title/aria-label attributes, alert/confirm dialogs and the page title.
// Only exact strings (and the patterns below) are translated, so user and agent text is never touched.
// To add a string: put the Czech text exactly as it appears on screen (trimmed) as a key in EN.
(function () {
  const EN = {
    // header, project list
    'Projekty': 'Projects', '← Projekty': '← Projects', 'Připojení': 'Connections', 'Aktualizace': 'Updates', 'Hledám…': 'Checking…',
    'Zadání projektu': 'Project brief', 'TVŮJ PRACOVNÍ PROSTOR': 'YOUR WORKSPACE', 'Jeden projekt. Vlastní repozitář. Vlastní kancelář.': 'One project. Its own repository. Its own office.',
    '+ Nový projekt': '+ New project', 'Nový projekt': 'New project', 'Hledat podle názvu nebo zadání…': 'Search by name or brief…', 'Hledat projekt': 'Search projects',
    'Zobrazení projektů': 'Project view', 'Aktivní projekty': 'Active projects', 'Archiv je prázdný': 'The archive is empty', 'Archivováno': 'Archived', 'Všechny': 'All',
    'Propojené pracovní složky z Claude Code': 'Linked Claude Code work folders', 'Vytvoř projekt a otevři jeho kancelář': 'Create a project and open its office',
    'Projekt si sám založí vlastní repozitář. Existující práce z Claude Code je oddělená níže.': 'The project sets up its own repository. Existing Claude Code work is listed separately below.',
    '+ Vytvořit projekt': '+ Create project', 'Žádný projekt neodpovídá hledání.': 'No project matches the search.', 'Nedávné projekty': 'Recent projects',
    'Projekt potřebuje pozornost': 'The project needs attention', 'Nedávná aktivita': 'Recent activity', 'Nedávná aktivita:': 'Recent activity:', 'Poslední aktivita:': 'Last activity:',
    'Claude Code · místní historie': 'Claude Code · local history', 'V tomto projektu zatím nejsou žádné Claude Code sessions.': 'This project has no Claude Code sessions yet.',
    'Otevřít v Claude Code': 'Open in Claude Code', 'Otevřít v Codexu': 'Open in Codex', 'Hosté ve složce': 'Guests in this folder', 'propojených složek': 'linked folders', 'projektů ·': 'projects ·',
    // new project dialog
    'Založit projekt': 'Create project', 'Název projektu': 'Project name', 'Např. Pitch pro klienta': 'E.g. Pitch for a client', 'O čem projekt je': 'What the project is about',
    'Projekt dostane vlastní kancelář i repozitář. Všechno založím za tebe.': 'The project gets its own office and repository. I will set everything up for you.',
    'Projekt se nepodařilo vytvořit. Zkus to znovu.': 'Could not create the project. Try again.', 'Připojit existující projekt': 'Connect an existing project',
    'Cesta ke složce': 'Folder path', 'Vybrat složku…': 'Choose folder…', 'Připojit': 'Connect', 'Přidat repozitář': 'Add repository', 'PŘIDAT REPO': 'ADD REPO',
    'Git repozitář': 'Git repository', 'Repozitář': 'Repository', 'Projekt a repozitář': 'Project and repository', 'Pracovní složka': 'Work folder', 'Pracovní kopie': 'Working copy',
    'Název mění pouze označení kanceláře. Soubory ani repozitář se nepřesouvají.': 'The name only changes the office label. Files and the repository do not move.',
    'Nastavení projektu': 'Project settings', 'Uložit': 'Save', 'Ukládám…': 'Saving…', 'Zrušit': 'Cancel', 'Zavřít': 'Close', 'Přidat': 'Add',
    // brief
    'ZADÁNÍ PRO ŠÉFA': 'BRIEF FOR THE BOSS', 'Co má tým udělat?': 'What should the team do?',
    'Popiš vlastními slovy, co chceš. Stačí pár vět – šéf si zbytek zjistí sám.': 'Describe what you want in your own words. A few sentences are enough – the boss will find out the rest.',
    'Šéf si sám udělá průzkum, plán i kontrolu kvality. Zeptá se jen na to nejnutnější.': 'The boss does the research, the plan and the quality check. It only asks what it really needs.',
    'Šéf naváže na to, co se v tomhle projektu už naučil.': 'The boss builds on what it already learned in this project.',
    'Přidat odkazy, podklady nebo poznámky': 'Add links, materials or notes', 'Odkazy na weby, cesty k souborům, co se ti líbí nebo nelíbí, termín…': 'Links, file paths, what you like or dislike, a deadline…',
    'Např. Přepracuj web firmy X pro pitch investorům. Důležitý je první dojem a mobil. Web je ve složce projektu.': 'E.g. Redesign company X\'s website for an investor pitch. First impression and mobile matter most. The site is in the project folder.',
    'Např. Přidej do aplikace přihlášení přes Google a napiš k tomu testy.': 'E.g. Add Google sign-in to the app and write tests for it.',
    'Např. Zjisti, jaké jsou nejlepší nástroje na e-mailový marketing pro malé české firmy, a doporuč jeden.': 'E.g. Find the best e-mail marketing tools for small businesses and recommend one.',
    'Např. Marketingový plán na 3 měsíce pro spuštění nového produktu, s rozpočtem do 50 000 Kč.': 'E.g. A 3-month marketing plan for a product launch with a budget of up to $2,000.',
    'Např. Napiš obchodní podmínky pro e-shop s ručně šitými taškami, srozumitelně a podle českého práva.': 'E.g. Write clear terms and conditions for an online shop selling handmade bags.',
    'Např. Pitch deck pro investory na 12 slajdů: problém, řešení, trh, byznys model, tým, finance.': 'E.g. A 12-slide investor pitch deck: problem, solution, market, business model, team, financials.',
    'Jak důkladně': 'How thorough', 'Intenzita práce': 'Effort', 'Rychle': 'Quick', 'Pečlivě': 'Careful', 'Do posledního detailu': 'Down to the last detail',
    'Jedno kolo práce a kontroly. Vhodné na rychlé věci.': 'One round of work and review. Good for quick things.',
    'Až tři kola práce, kontroly a oprav. Šéf pustí výsledek, až bude opravdu dobrý.': 'Up to three rounds of work, review and fixes. The boss releases the result only when it is really good.',
    'Až pět kol a přísné hodnocení. Spotřebuje víc limitu.': 'Up to five rounds and strict grading. Uses more of your limits.',
    'Délka výsledné zprávy': 'Length of the final report', 'Stručná': 'Short', 'Přehledná': 'Clear', 'Podrobná': 'Detailed',
    '🔎 Průzkum': '🔎 Research', '✳️ Jiné': '✳️ Other', 'Obchodní podmínky': 'Terms and conditions', 'Analýza konkurence': 'Competitor analysis',
    // office view
    'Připraveno': 'Ready', 'Probíhá': 'Running', 'Pracuje': 'Working', 'Hotovo': 'Done', 'Čeká': 'Waiting', 'Čeká na tebe': 'Waiting for you', 'Čeká na odpověď': 'Waiting for an answer',
    'Pozastaveno': 'Paused', 'Zastaveno': 'Stopped', 'Přerušeno': 'Interrupted', 'Zablokováno': 'Blocked', 'Zablokováno:': 'Blocked:', 'Rozpracováno': 'In progress', 'Došel limit': 'Limit reached', 'Došel rozpočet': 'Budget used up',
    'Zadej šéfovi první cíl.': 'Give the boss a first goal.', 'Zadej první úkol šéfovi.': 'Give the boss a first task.', 'Nový cíl': 'New goal', 'Pozastavit': 'Pause', 'Zastavit': 'Stop', 'Pokračovat': 'Continue',
    'Průběh a spotřeba': 'Progress and usage', 'Další akce': 'More actions', 'Zadání': 'Brief', 'Rešerše': 'Research', 'Kritéria': 'Criteria', 'Plán': 'Plan', 'Práce': 'Work',
    'Kontrola': 'Review', 'Hodnocení': 'Grading', 'Výsledek': 'Result', 'Postup projektu': 'Project steps', 'Aktuální krok': 'Current step', 'Fáze': 'Phase',
    'Kancelář': 'Office', 'Tým': 'Team', 'Zobrazení': 'View', 'Kancelář šéfa': 'Boss\'s office', 'Kancelář agentů': 'Agents\' office', 'Kancelář týmu': 'Team office',
    'Tým pracuje': 'Team is working', 'Celý tým pracuje': 'The whole team is working', '+ Přidat roli': '+ Add role', 'Zobrazit celý tým': 'Show the whole team',
    'Harvey Specter': 'Harvey Specter', 'Šéf projektu': 'Project boss', 'Šéf': 'Boss', '· šéf': '· boss', '· asistentka': '· assistant', 'Šéf:': 'Boss:',
    'Jsem tady. Co má tým zařídit?': 'I\'m here. What should the team take care of?', 'Řekni šéfovi, co potřebuješ…': 'Tell the boss what you need…',
    'Řekni šéfovi, co má tým zařídit.': 'Tell the boss what the team should do.', 'Poslat šéfovi': 'Send to the boss', 'Rozhovor se šéfem': 'Chat with the boss',
    'Odpověz šéfovi…': 'Answer the boss…', 'Šéf potřebuje tvou odpověď': 'The boss needs your answer', 'Díky, odpověď jsem předal šéfovi.': 'Thanks, I passed your answer to the boss.',
    'Šéf přebírá zadání a připravuje tým…': 'The boss is taking the brief and preparing the team…', 'Předávám tvůj pokyn šéfovi…': 'Passing your instruction to the boss…',
    'Pokyn se nepodařilo předat.': 'Could not pass the instruction on.', 'Nepodařilo se odeslat': 'Could not send', 'Pokyn pro šéfa': 'Instruction for the boss', 'Předat šéfovi →': 'Pass to the boss →',
    'Změň směr celého projektu… (Boss upraví vkus, scorecard a plán)': 'Change the direction of the whole project… (the boss updates taste, scorecard and plan)',
    'Předpoklady bosse (můžeš vetovat)': 'The boss\'s assumptions (you can veto them)', 'Paměť šéfa': 'Boss\'s memory',
    'Úkoly': 'Tasks', 'Úkoly se objeví, jakmile šéf sestaví plán.': 'Tasks appear once the boss has made a plan.', 'Hotové úkoly': 'Finished tasks', 'Historie úkolů': 'Task history',
    'zatím žádné dřívější úkoly': 'no earlier tasks yet', 'Dřívější cíle v téhle kanceláři': 'Earlier goals in this office', 'kritické': 'critical',
    'Výstupy': 'Outputs', 'Výstup': 'Output', 'Výstupy projektu': 'Project outputs', 'Výsledky': 'Results', 'Hotové soubory se tady objeví samy.': 'Finished files show up here by themselves.',
    'Hotové soubory se tady objeví automaticky.': 'Finished files show up here automatically.', 'Otevřít v Macu ↗': 'Open on the Mac ↗', 'Zavřít výstup': 'Close output', 'Načítám soubor…': 'Loading file…',
    '… Náhled zkrácen. Celý soubor otevři v Macu.': '… Preview shortened. Open the whole file on the Mac.', 'Dokument je připravený. Otevři ho v příslušné aplikaci na Macu.': 'The document is ready. Open it in the right app on your Mac.',
    'Souhrn zakázky': 'Project summary', '★ Zobrazit souhrn zakázky': '★ Show project summary', 'Závěr': 'Conclusion',
    'Průběh projektu': 'Project progress', 'Zobrazit průběh': 'Show progress', 'Zavřít průběh': 'Close progress', 'Průběh práce se nezobrazuje, aby tě nerušil.': 'Work progress is hidden so it does not distract you.',
    'Spotřeba tohoto projektu': 'Usage of this project', 'Spotřeba tohoto cíle': 'Usage of this goal', 'Běhy': 'Runs', 'Čas': 'Time', 'tokenů (vstup + výstup)': 'tokens (input + output)',
    'Neúspěšné pokusy spotřebovaly': 'Failed attempts used', 'Zatím nic.': 'Nothing yet.', 'zatím nic': 'nothing yet', 'Nic k nabídnutí.': 'Nothing to offer.',
    'Nepodařilo se spojit s kanceláří.': 'Could not reach the office.', 'Nepodařilo se spojit s kanceláří. Zkus to znovu.': 'Could not reach the office. Try again.',
    // agent panel
    'Tento zaměstnanec zatím nedostal úkol. Řekni šéfovi dole, co má tým zařídit.': 'This team member has no task yet. Tell the boss below what the team should do.',
    'Zatím nic. Až agent začne pracovat, uvidíš tady, co dělá.': 'Nothing yet. Once the agent starts working you will see here what it does.',
    'Teď:': 'Now:', 'Čeká:': 'Waiting:', 'Zbývá:': 'Left:', 'Změněno:': 'Changed:', '✓ Hotovo:': '✓ Done:', 'Poslední model': 'Last model',
    'Model': 'Model', 'Model tohoto agenta': 'This agent\'s model', 'Model a intenzita tohoto agenta': 'This agent\'s model and effort', 'Uložit pro tohoto agenta': 'Save for this agent',
    'Vybere šéf podle úkolu a kapacity': 'Chosen by the boss by task and capacity', 'Vybere šéf podle role': 'Chosen by the boss by role', 'Platí od dalšího kroku v této kanceláři.': 'Applies from the next step in this office.',
    'Uloženo. Platí od dalšího kroku pouze pro tohoto agenta.': 'Saved. Applies from the next step, for this agent only.', 'Uloženo. Volba platí od dalšího kroku každého agenta.': 'Saved. Applies from each agent\'s next step.',
    'Nízká': 'Low', 'Střední': 'Medium', 'Vysoká': 'High', 'Velmi vysoká': 'Very high', 'Maximální': 'Maximum',
    'Předávám zprávu. Agent zohlední rozdělanou práci a pokračuje…': 'Passing the message on. The agent takes the work in progress into account and continues…',
    'Vzhled zaměstnance': 'Team member\'s look', 'Vlastní jméno': 'Custom name', 'Za co odpovídá': 'Responsible for',
    // roles
    'Přidat roli': 'Add role', 'PŘIDAT ROLI': 'ADD ROLE', 'Přidat roli do kanceláře': 'Add a role to the office', 'Název role': 'Role name',
    'Např. Finance, Právník, Copywriter, Analytik': 'E.g. Finance, Lawyer, Copywriter, Analyst', 'Např. finanční model a čísla v pitch decku, kontrola, že vše sedí': 'E.g. the financial model and numbers in the pitch deck, checking that everything adds up',
    'Boss s ní bude počítat v plánu. Projekt se přidává v přehledu projektů.': 'The boss will include it in the plan. Projects are added in the project overview.',
    'Designér': 'Designer', 'Výzkumnice': 'Researcher', 'Výzkumník': 'Researcher', 'Právník': 'Lawyer', 'Tester': 'Tester', 'Copywriter': 'Copywriter', 'Ostatní': 'Others',
    // connections
    'Připojení a limity': 'Connections and limits', 'Boss používá Claude Opus, ostatním agentům vybírá model sám. Model konkrétního agenta změníš kliknutím na něj.': 'The boss uses Claude Opus and picks a model for every other agent. Click an agent to change its model.',
    'Připojeno': 'Connected', 'Odpojeno': 'Disconnected', 'Limit vyčerpán': 'Limit used up', 'Připojeno přes Antigravity': 'Connected via Antigravity', 'Připojit znovu': 'Reconnect', '⟳ Připojit znovu': '⟳ Reconnect',
    'Jak připojit': 'How to connect', 'Limity zatím nejsou známé.': 'Limits are not known yet.', '5hodinový limit': '5-hour limit', 'Týdenní limit': 'Weekly limit', '· obnoví se': '· resets',
    'Kapacitu se nepodařilo načíst.': 'Could not load capacity.', 'Připojit model': 'Connect a model', 'Přihlášení:': 'Sign-in:', 'trvalý token z Klíčenky': 'long-lived token from the Keychain', 'účet v Terminálu (může vypršet)': 'account in Terminal (can expire)',
    'Používá přihlášení aplikace Codex / ChatGPT na tomhle Macu.': 'Uses the Codex / ChatGPT sign-in on this Mac.', 'na kód a úpravy souborů': 'for code and file edits',
    'Dokonči přihlášení v Terminálu. Při tvorbě tokenu ho potom vlož do pole pro Klíčenku.': 'Finish signing in in Terminal. If you created a token, paste it into the Keychain field.',
    'Ukládám do Klíčenky…': 'Saving to the Keychain…', 'Uloženo v Klíčence. Token se použije při dalších spuštěních Claude.': 'Saved in the Keychain. The token is used the next time Claude runs.',
    'Trvalý token (platí rok) – v Terminálu spusť': 'Long-lived token (valid for a year) – in Terminal run', 'a vlož ho sem': 'and paste it here', 'Token': 'Token',
    'Fast mode': 'Fast mode', 'Ultrareview': 'Ultrareview', 'Automaticky': 'Automatic', 'Vypnuto': 'Off', 'Vždy': 'Always', 'Ptát se': 'Ask',
    'Rychlejší odpovědi Opus/Fable v rozhovoru za vyšší spotřebu.': 'Faster Opus/Fable replies in chat, at higher usage.',
    'Teď nedostupný: v účtu Claude jsou vypnuté usage credits.': 'Unavailable now: usage credits are turned off in the Claude account.', 'Teď nedostupný pro tento účet.': 'Unavailable for this account now.',
    'Cloudová kontrola kódu více agenty, když šéf mění kód. Účtuje se zvlášť a trvá až 45 minut.': 'Multi-agent cloud code review when the boss changes code. Billed separately, takes up to 45 minutes.',
    'Není k dispozici (vyžaduje novější Claude Code a přihlášení).': 'Not available (needs a newer Claude Code and sign-in).',
    'Procenta jsou limity služby, nikoli počet zbývajících tokenů. Neznámý limit se neodhaduje.': 'Percentages are the service\'s limits, not remaining tokens. Unknown limits are not guessed.',
    'Gemini CLI': 'Gemini CLI',
    // connection guides (text pieces between the <code>/<b> parts)
    'Nainstaluj Claude Code: v Terminálu spusť': 'Install Claude Code: in Terminal run', 'Klikni na': 'Click', '(otevře se Terminál s': '(Terminal opens with',
    ') a přihlas se svým účtem Claude (Pro/Max).': ') and sign in with your Claude account (Pro/Max).', 'Aby přihlášení nevypršelo: v Terminálu spusť': 'So the sign-in does not expire: in Terminal run',
    'a vygenerovaný token vlož výše do pole „Trvalý token“. Uloží se jen do Klíčenky tohoto Macu.': 'and paste the token into the "Long-lived token" field above. It is stored only in this Mac\'s Keychain.',
    'Nainstaluj Codex:': 'Install Codex:', '(nebo': '(or', ', případně aplikaci ChatGPT pro Mac).': ', or the ChatGPT app for Mac).', '(otevře se': '(opens',
    ') a přihlas se účtem ChatGPT (Plus/Pro).': ') and sign in with your ChatGPT account (Plus/Pro).', 'Hotovo. Šéf pak dává Codexu hlavně programování; u každého agenta ho můžeš vybrat i ručně.': 'Done. The boss then gives Codex mostly programming; you can also pick it for any agent.',
    'Volitelné. Nainstaluj Antigravity CLI:': 'Optional. Install the Antigravity CLI:', '(příkaz': '(command', ').': ').', '. V Terminálu se spustí': '. Terminal runs',
    'a v prohlížeči se přihlásíš účtem Google. Přihlášení se uloží do Klíčenky.': 'and you sign in with your Google account in the browser. The sign-in is stored in the Keychain.',
    'Když je připojený, šéf mu sám dává programování, hlavně když Codex chybí nebo mu dochází limit. U agenta ho můžeš vybrat i ručně: klikni na postavu → Model. Smí upravovat soubory, příkazy v Terminálu ne.': 'Once connected, the boss gives it programming by itself, mainly when Codex is missing or running low. You can also pick it for an agent: click the character → Model. It may edit files but not run Terminal commands.',
    'Volitelné, hodí se na studium a rešerše. Nainstaluj Gemini CLI:': 'Optional, good for study and research. Install the Gemini CLI:', 'a přihlásíš se účtem Google (nebo nastav': 'and you sign in with your Google account (or set',
    'Když je připojené, šéf mu sám dává studium a rešerše. U agenta ho můžeš vybrat i ručně: klikni na postavu → Model. Smí upravovat soubory, příkazy v Terminálu ne.': 'Once connected, the boss gives it study and research by itself. You can also pick it for an agent: click the character → Model. It may edit files but not run Terminal commands.',
    // updates
    'Je k dispozici nová verze Agent Office.': 'A new version of Agent Office is available.', 'Ve složce s kódem aktualizuj přes git pull.': 'In a code checkout, update with git pull.',
    'Co je nového:': 'What\'s new:', 'Běžící projekty se na chvilku přeruší a pak pokračují.': 'Running projects pause for a moment and then continue.', 'Stahuji…': 'Downloading…', 'Restartuji…': 'Restarting…',
    // limits
    'Pokračuji automaticky, jakmile se limit obnoví.': 'I will continue automatically once the limit resets.', 'Limit ještě platí, zkusím to sám později.': 'The limit still applies, I will try again later by myself.',
    'Zkouším…': 'Trying…', 'Zkusit znovu': 'Try again',
    // agent activity and statuses from the server
    'čeká': 'waiting', 'čeká na tebe': 'waiting for you', 'čeká na zadání': 'waiting for a brief', 'rozděluje práci': 'splitting up the work', 'hlídá postup': 'watching progress',
    'kontroluje výsledek': 'checking the result', 'potřebuje rozhodnutí': 'needs a decision', 'pracuje': 'working', 'hotovo': 'done', 'dělá screenshot': 'taking a screenshot',
    'hledá soubory': 'looking for files', 'rozpracováno': 'in progress', 'pokračuji po limitu': 'continuing after the limit', 'úkol': 'task', 'rozhovor': 'chat', '(bez odpovědi)': '(no answer)',
    'Zkoumám zadání a projekt…': 'Studying the brief and the project…', 'Pokračuji od posledního ověřeného stavu.': 'Continuing from the last verified state.',
    'Aplikace se restartovala – pokračuji sám od posledního ověřeného stavu.': 'The app restarted – continuing by myself from the last verified state.',
    'Pozastaveno. Až budeš chtít, navážu přesně tady.': 'Paused. Whenever you want, I will pick up right here.', 'Konzultuji problém se šéfem': 'Consulting the boss about a problem',
    'Soudím výsledek': 'Grading the result', 'Spouštím Claude ultrareview (cloud).': 'Starting Claude ultrareview (cloud).', 'Žádné nálezy.': 'No findings.', 'Zkouším to znovu hned.': 'Trying again right away.',
    'Vyčerpán rozpočet běhů – vracím rozpracovaný výsledek se seznamem mezer.': 'Run budget used up – returning the work in progress with a list of gaps.',
    'Navazuji na poslední ověřený stav – hotové a zkontrolované části znovu nedělám.': 'Picking up from the last verified state – finished and checked parts are not redone.',
    'Cíl není git repo – pracuji přímo v něm (bez větve).': 'The target is not a git repo – working in it directly (no branch).', 'Boss upravil vkus/scorecard podle tvé zprávy.': 'The boss updated taste/scorecard based on your message.',
    'Zapsal jsem si to – zohledním to hned, jak začnu plánovat.': 'Noted – I will take it into account as soon as I start planning.', 'Zatím jsem nedostal žádný úkol. Předávám zprávu Bossovi.': 'I have no task yet. Passing the message to the boss.',
    'Žádný model teď nemá volnou kapacitu.': 'No model has free capacity right now.', 'Projekt se třikrát za hodinu přerušil – nepokračuji automaticky. Použij „Pokračovat“.': 'The project was interrupted three times in an hour – not continuing automatically. Use "Continue".',
    'Průzkum zadání': 'Studying the brief', 'Vkus a kritéria': 'Taste and criteria', 'Hodnocení kola': 'Round grading', 'Změna přístupu': 'Change of approach', 'Nová relace šéfa': 'New boss session', 'Založení projektu': 'Project setup',
    'Odpovědi uživatele': 'User\'s answers', 'Přeskočit': 'Skip', 'Uživatel nepovolil.': 'The user did not allow it.', 'Vypnuto v nastavení Připojení.': 'Turned off in Connections.', 'Závislosti se nedokončily.': 'Dependencies did not finish.',
    // server errors
    'Napiš cíl.': 'Write a goal.', 'Napiš název role.': 'Write a role name.', 'Napiš název projektu (nejvýše 80 znaků, bez lomítek).': 'Write a project name (up to 80 characters, no slashes).',
    'Název musí mít 1–80 znaků.': 'The name must have 1–80 characters.', 'Projekt s tímto názvem už existuje. Otevři jeho kancelář nebo zvol jiný název.': 'A project with this name already exists. Open its office or choose another name.',
    'Tahle role už v kanceláři je. Zvol jiný název.': 'This role is already in the office. Choose another name.', 'Kancelář právě pracuje – nejdřív ji zastav.': 'The office is working right now – stop it first.',
    'Tahle kancelář právě pracuje na cíli – počkej, nebo ji zastav.': 'This office is working on a goal – wait or stop it.', 'Nejdřív zastav práci na projektu.': 'Stop the work on the project first.',
    'Projekt právě běží.': 'The project is running.', 'Projekt je v archivu. Nejdřív ho obnov.': 'The project is archived. Restore it first.', 'Pokračovat jde jen u nedokončeného projektu.': 'Only an unfinished project can be continued.',
    'Složka neexistuje.': 'The folder does not exist.', 'Neznámý repozitář.': 'Unknown repository.', 'Neznámý agent.': 'Unknown agent.', 'Neznámý model.': 'Unknown model.', 'Neznámá aplikace.': 'Unknown app.', 'Neznámá intenzita práce.': 'Unknown effort.',
    'Claude CLI chybí.': 'Claude CLI is missing.', 'Codex CLI chybí.': 'Codex CLI is missing.', 'Gemini CLI chybí.': 'Gemini CLI is missing.', 'Antigravity CLI (agy) chybí.': 'Antigravity CLI (agy) is missing.',
    'Claude není přihlášené. Klikni na Přihlásit a dokonči přihlášení v Terminálu.': 'Claude is not signed in. Click Sign in and finish in Terminal.', 'Claude není přihlášený. Přihlas účet nebo ulož dlouhodobý token.': 'Claude is not signed in. Sign in or save a long-lived token.',
    'Claude není dostupný.': 'Claude is not available.', 'Codex není dostupný.': 'Codex is not available.', 'Codex není nainstalovaný.': 'Codex is not installed.', 'Codex neodpověděl včas.': 'Codex did not answer in time.', 'Přihlas Codex přes ChatGPT.': 'Sign in to Codex with ChatGPT.',
    'Gemini CLI není nainstalované (volitelné).': 'Gemini CLI is not installed (optional).', 'Antigravity CLI (agy) není nainstalované (volitelné).': 'Antigravity CLI (agy) is not installed (optional).',
    'Gemini není přihlášené. Klikni na Připojit znovu a přihlas se účtem Google.': 'Gemini is not signed in. Click Reconnect and sign in with your Google account.',
    'Antigravity není přihlášené. Spusť ho jednou v Terminálu (Připojit znovu) a přihlas se účtem Google.': 'Antigravity is not signed in. Run it once in Terminal (Reconnect) and sign in with your Google account.',
    'Šéf mu sám dává programování, u agenta ho můžeš vybrat i ručně.': 'The boss gives it programming by itself; you can also pick it for an agent.',
    'Šéf mu sám dává studium a rešerše, u agenta ho můžeš vybrat i ručně.': 'The boss gives it study and research by itself; you can also pick it for an agent.',
    'Žádný model není dostupný. Přihlas Claude nebo Codex v okně Připojení.': 'No model is available. Sign in to Claude or Codex in Connections.', 'Vybraný model není dostupný nebo vyčerpal limit.': 'The chosen model is not available or has used up its limit.',
    'Není dostupný žádný model. Přihlas Claude nebo Codex, případně spusť Ollamu.': 'No model is available. Sign in to Claude or Codex, or start Ollama.',
    'Token se nepodařilo uložit do Klíčenky. Odemkni ji a zkus to znovu.': 'Could not save the token to the Keychain. Unlock it and try again.', 'Vlož OAuth token vypsaný příkazem claude setup-token.': 'Paste the OAuth token printed by claude setup-token.',
    'Model nevrátil požadovaný JSON výsledek.': 'The model did not return the required JSON result.', 'Usage Claude nyní není dostupné.': 'Claude usage is not available right now.', 'Ollama vypnutá': 'Ollama is off',
    'Zatím není co shrnout.': 'Nothing to summarize yet.', 'Shrnutí se nepovedlo.': 'The summary failed.', 'Otevření souboru vyžaduje Mac.': 'Opening a file needs a Mac.', 'Soubor není mezi výstupy projektu.': 'The file is not among the project outputs.',
    'Aktualizace jde jen v Mac aplikaci. Ve složce s kódem použij git pull.': 'Updates work only in the Mac app. In a code checkout use git pull.', 'Už máš nejnovější verzi.': 'You already have the latest version.',
    'Tahle verze potřebuje novou aplikaci. Stáhni ji z GitHubu.': 'This version needs a new app. Download it from GitHub.', 'Stažená verze není novější.': 'The downloaded version is not newer.', 'Stažený balík neobsahuje Agent Office.': 'The download does not contain Agent Office.',
    // demo and sample data
    'Tmavý nebo světlý design?': 'Dark or light design?', 'Tmavý': 'Dark', 'Světlý': 'Light', 'Redesign webu pro pitch': 'Website redesign for a pitch', 'Nový design portfolia': 'New portfolio design', 'Aplikace pro TV': 'TV app',
    'Landing page': 'Landing page', 'Pitch deck pro investory': 'Investor pitch deck', 'Q1 marketing': 'Q1 marketing', 'Nové endpointy': 'New endpoints', 'Onboarding': 'Onboarding', 'Manuál značky': 'Brand manual', 'Nový ceník': 'New price list',
    'Výzkum trhu': 'Market research', 'Vyjednávání': 'Negotiation', 'Oprava přihlášení v API': 'Fix sign-in in the API', 'Projdu místa, kde se token obnovuje.': 'I will go through where the token gets refreshed.',
    'Soudkyně Moore': 'Judge Moore',
  };
  // dynamic strings: [pattern, replacement or function]
  const PATTERNS = [
    [/^(\d+) % zbývá$/, '$1% left'],
    [/^Přihlášení: (.+)\.$/, (m, a) => 'Sign-in: ' + tr(a) + '.'],
    [/^Na studium a rešerše s vyhledáváním Google\. ?(.*)$/, (m, a) => 'For study and research with Google search. ' + tr(a)],
    [/^v (\d{1,2}:\d{2})$/, 'at $1'],
    [/^(.+) · šéf$/, '$1 · boss'], [/^(.+) · asistentka$/, '$1 · assistant'],
    [/^Aktuální krok · (.+)$/, 'Current step · $1'],
    [/^Napiš: (.+)$/, 'Message $1'],
    [/^(.+?) – ([^–]+)$/, (m, a, b) => { const t = tr(b); return t === b ? m : a + ' – ' + t; }],
    [/^Spravovat projekt (.+)$/, 'Manage project $1'],
    [/^Otevřít projekt (.+)$/, 'Open project $1'],
    [/^Týdenní limit · (.+)$/, 'Weekly limit · $1'],
    [/^· obnoví se (.+)$/, (m, a) => '· resets ' + a],
    [/^Model · (.+)$/, (m, a) => 'Model · ' + tr(a)],
    [/^(.+) · nedostupný$/, '$1 · unavailable'],
    [/^Aktualizovat na (.+)$/, 'Update to $1'],
    [/^Nová aplikace (.+)$/, 'New app $1'],
    [/^Verze (.+)$/, 'Version $1'],
    [/^Máš nejnovější verzi (.*)$/, 'You have the latest version $1'],
    [/^Aktualizovat Agent Office z (.+) na (.+)\?$/, 'Update Agent Office from $1 to $2?'],
    [/^Verze (.+) potřebuje novou aplikaci\. Otevřít stránku ke stažení\?$/, 'Version $1 needs a new app. Open the download page?'],
    [/^Staženo \((.+)\)\. Restartuj aplikaci\.$/, 'Downloaded ($1). Restart the app.'],
    [/^Novou verzi se nepodařilo zjistit: GitHub odpověděl (\d+)$/, 'Could not check for a new version: GitHub answered $1'],
    [/^Novou verzi se nepodařilo zjistit: (.+)$/, 'Could not check for a new version: $1'],
    [/^(\d+) projektů · (\d+) propojených složek$/, '$1 projects · $2 linked folders'],
    [/^Tým (\d+)$/, 'Team $1'],
    [/^(\d+) otázek$/, '$1 questions'],
    [/^Čeká na (.+)$/, (m, a) => 'Waiting for ' + tr(a)],
    [/^Najímám: (.+)$/, 'Hiring: $1'],
    [/^Nový cíl: (.+)$/, 'New goal: $1'],
    [/^Používám (.+)$/, 'Using $1'],
    [/^Úkol se nepodařil: (.+)$/, 'Task failed: $1'],
    [/^čte (.+)$/, 'reading $1'], [/^otevírá (.+)$/, 'opening $1'], [/^spouští: (.+)$/, 'running: $1'], [/^prohledává kód: (.+)$/, 'searching code: $1'], [/^hledá na webu „(.+)“$/, 'searching the web for "$1"'],
    [/^otevírá v prohlížeči: (.+)$/, 'opening in the browser: $1'], [/^Pokračuji v projektech: (.+)$/, 'Continuing projects: $1'],
    [/^(\d+) úkolů je hotových z minula – nedělám je znovu\.$/, '$1 tasks were finished earlier – not redoing them.'],
  ];
  const cache = new Map();
  function tr(s) {
    if (lang !== 'en' || typeof s !== 'string' || !s) return s;
    const core = s.trim(); if (!core) return s;
    let out = cache.get(core);
    if (out === undefined) {
      out = Object.prototype.hasOwnProperty.call(EN, core) ? EN[core] : null;
      if (out === null) for (const [re, rep] of PATTERNS) if (re.test(core)) { out = core.replace(re, rep); break; }
      if (cache.size > 5000) cache.clear(); cache.set(core, out);
    }
    return out === null ? s : s.replace(core, out);
  }
  const trLines = (s) => (typeof s === 'string' ? s.split('\n').map(tr).join('\n') : s);
  let lang = 'en';
  try { lang = localStorage.getItem('ao-lang') || 'en'; } catch {}
  const api = { EN, PATTERNS, tr, trLines, get lang() { return lang; }, setLang(l) { lang = l === 'cs' ? 'cs' : 'en'; try { localStorage.setItem('ao-lang', lang); } catch {} cache.clear(); } };
  globalThis.AO_I18N = api;
  if (typeof document === 'undefined') return;

  // ---- browser: translate the DOM as it renders ----
  document.documentElement.lang = lang;
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
  function fixNode(n) {
    if (n.nodeType === 3) { const p = n.parentNode; if (p && !SKIP.has(p.nodeName) && !p.closest?.('[data-noi18n]')) { const t = tr(n.data); if (t !== n.data) n.data = t; } return; }
    if (n.nodeType !== 1 || n.closest('[data-noi18n]')) return;
    for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }   // a textarea's placeholder too
    if (SKIP.has(n.nodeName)) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let c = w.nextNode(); c; c = w.nextNode()) {
      if (c.nodeType === 1) { if (c.hasAttribute('data-noi18n')) continue; for (const a of ATTRS) { const v = c.getAttribute(a); if (v) { const t = tr(v); if (t !== v) c.setAttribute(a, t); } } }
      else if (c.parentNode && !SKIP.has(c.parentNode.nodeName) && !c.parentNode.closest('[data-noi18n]')) { const t = tr(c.data); if (t !== c.data) c.data = t; }
    }
  }
  if (lang === 'en') {
    const start = () => {
      fixNode(document.body); document.title = tr(document.title);
      new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fixNode(m.target); else if (m.type === 'attributes') fixNode(m.target); else m.addedNodes.forEach(fixNode); } })
        .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    const A = window.alert.bind(window), C = window.confirm.bind(window);
    window.alert = (m) => A(trLines(m)); window.confirm = (m) => C(trLines(m));
  }
})();
