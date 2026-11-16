# Agent Office – sedící postavy do kanceláře (zadání pro Codex)

Ahoj, potřebuju vygenerovat herní assety do aplikace. Kancelář a stojící postavy už máme (jsou v přiloženém zipu).
Chybí nám **sedící postavy** a pár doplňkových póz. Všechno musí stylem, světlem i měřítkem sedět k tomu, co už existuje.
Níž je přesný seznam souborů, technické požadavky a hotové prompty. Prosím drž se názvů souborů, napojím je automaticky.

---

## 0. Co je v zipu (reference)

| Soubor | K čemu |
|---|---|
| `office.png` | Kancelář (2172 × 724). Určuje úhel kamery, světlo a měřítko. |
| `standing/<id>.png` | 32 stojících postav, každá zvlášť, průhledné pozadí. **Hlavní reference vzhledu**: vlasy, oblečení, barvy, proporce. |
| `sheets/*.png` | Původní archy, ze kterých stojící postavy vznikly (pro styl). |
| `crops/chair.png`, `crops/harvey-office.png`, `crops/donna-desk.png` | Výřezy kanceláře: kancelářská židle, Harveyho stůl s křeslem, Donnina recepce. |
| `scene-now-*.png` | Jak to vypadá teď (stůl, Harvey, Donna). Ukázka, proč to potřebujeme předělat. |

**Ke každému promptu přilož `office.png` a stojící postavu (nebo postavy), které generuješ.** Bez reference se rozjede styl.

---

## 1. Technické požadavky (platí pro všechno)

1. **Styl:** totožný se stojícími postavami. Stylizovaný low-poly 3D vzhled s měkkým malířským stínováním, čisté plochy, realistické dospělé proporce. Žádná fotografie, žádný anime, žádné pixel art.
2. **Světlo:** teplé hlavní světlo zleva shora (od oken), jemné vyplňující světlo zprava. Stejné jako na `office.png`.
3. **Kamera:** stejný zvýšený pohled 3/4 shora jako kancelář, kamera se dívá dolů asi pod 35–40°. U „zezadu“ vidíme temeno a záda shora, u „zepředu“ obličej mírně shora.
4. **Pozadí:** průhledné PNG s **čistým alfa kanálem**. Žádný barevný lem (u starých archů byly kolem postav červené a žluté šmouhy), žádný šum, žádná šachovnice, žádná podlaha, žádný vržený stín, žádný text.
5. **Jedna postava = jeden soubor**, postava uprostřed, kolem ní 5–10 % prázdného místa.
6. **Rozlišení:** stojící a chodící postava asi 600 px na výšku. Sedící zezadu asi 360 px (od temene po sedák). Harvey a Donna vsedě asi 600 × 600.
7. **Měřítko:** hlava musí mít ve všech souborech stejnou velikost jako u stojících postav ve stejném rozlišení. Sedící nesmí být větší ani menší než stojící.
8. **Bez židlí a stolů**, pokud zadání výslovně neříká jinak. Židle a stoly jsou namalované v `office.png` a postavy do nich vkládáme. Opěradlo z kanceláře kreslíme přes záda.
9. **Formát:** PNG, sRGB, 8 bit + alfa.

---

## 2. Co potřebujeme (priority)

### Priorita 1: sedící zezadu (30 souborů)

Každá postava kromě Harveyho a Donny sedí u stolu **zády k nám** a pracuje na počítači.
Vidíme temeno a zadní část hlavy (vlasy), krk, ramena, záda saka nebo oblečení a lokty mírně od těla. Předloktí míří dopředu ke klávesnici a jsou z velké části schovaná za tělem. Postava je oříznutá **od temene po sedák** (boky). Nohy, židli ani stůl nekreslit.

- Soubor: `seat-back/<id>.png`
- Vlasy, barva a střih oblečení musí přesně odpovídat stojící postavě. Je to ta samá osoba, jen zezadu.
- Věci, které stojící postava drží (krabice, desky, kufřík, raketa), se ve vsedě nekreslí. Popruh tašky přes rameno (Mike, Esther, Tara, Marcus) zezadu vidět může.

### Priorita 1: Harvey a Donna čelem (5 souborů)

| Soubor | Popis |
|---|---|
| `seat-front/harvey.png` | Harvey sedí **čelem k nám**, opřený, sebevědomý, předloktí volně na hraně stolu. Bez křesla a bez stolu. Kreslit od temene po stehna. |
| `seat-front/harvey-ask.png` | Totéž, ale zvedá jednu ruku a dívá se na nás, jako by se ptal („potřebuju od tebe odpověď“). |
| `seat-front/harvey-type.png` | Totéž, ale dívá se dolů vlevo na monitor a ruce má na klávesnici. |
| `seat-front/donna.png` | Donna sedí **čelem k nám**, u ucha drží telefon, mírný úsměv. Bez židle a bez stolu, od temene po stehna. |
| `seat-front/donna-type.png` | Donna sedí čelem, píše na klávesnici a dívá se dolů. |

Harveyho křeslo a Donninu recepci máme v `office.png`, postavy do nich vložíme. Proto nesmí mít židli a musí sedět rovně a symetricky, aby seděly do křesla.

### Priorita 2: chůze (64 souborů, výrazně zlepší animaci)

Každá z 32 postav ve dvou fázích kroku, stojící čelem k nám v mírném natočení 3/4, stejné měřítko jako stojící:
- `walk/<id>-a.png`: levá noha vpředu, pravá ruka vpředu
- `walk/<id>-b.png`: pravá noha vpředu, levá ruka vpředu

Spodek chodidel musí být ve stejné výšce jako u stojící postavy, aby se fáze daly střídat bez poskakování.

### Priorita 3: víc postav (volitelné)

Další postavy ze seriálu Suits ve stejném stylu, každá ve třech pózách: stojící čelem, sedící zezadu a dvě fáze chůze.
Návrhy: Cameron Dennis, Sean Cahill, Andrew Malik, Brian Altman, Jonathan Sidwell, Faye Richardson, Zoe Lawford, Dana Scott (tmavší kostým), Paula Agard, Laura Zane, Gordon Specter, Lily Specter, Kevin Miller, Claire Bennett.
Soubory: `standing/<new-id>.png`, `seat-back/<new-id>.png`, `walk/<new-id>-a.png`, `walk/<new-id>-b.png`. Id piš malými písmeny bez diakritiky (například `cahill`).

---

## 3. Postavy (id → kdo to je → jak vypadá)

Popis odpovídá souboru `standing/<id>.png`. Vzhled ber vždy z obrázku, text je jen kontrola.

| id | Postava | Vzhled (vlasy · oblečení) |
|---|---|---|
| harvey | Harvey Specter | tmavě hnědé uhlazené vlasy · tmavomodrý oblek, bílá košile, tmavomodrá kravata, kapesníček |
| donna | Donna Paulsen | dlouhé vlnité zrzavé vlasy · švestkové přiléhavé šaty |
| mike | Mike Ross | rozcuchané hnědé vlasy · antracitový oblek, úzká tmavá kravata, hnědá kožená taška přes tělo |
| rachel | Rachel Zane | dlouhé tmavě hnědé vlnité vlasy · krémová halenka s vyhrnutými rukávy, tmavě šedá pouzdrová sukně |
| louis | Louis Litt | prořídlé tmavé vlasy · hnědý tříkusový oblek s proužkem, vzorovaná hnědá kravata |
| jessica | Jessica Pearson | dlouhé tmavé vlnité vlasy · krémové přiléhavé šaty s odhalenými rameny |
| harold | Harold Gunderson | kudrnaté zrzavé vlasy · hnědé sako, olivová pletená vesta, košile |
| norma | Norma | krátké tmavé kudrnaté vlasy · hořčicová halenka, tmavě šedá sukně |
| kyle | Kyle Durant | krátké zrzavé vlasy, pihy · šedý oblek, tmavomodrá kravata |
| scottie | Dana Scott | dlouhé tmavé vlnité vlasy · vínový svetřík, krémová halenka, béžová sukně |
| hardman | Daniel Hardman | tmavé vlasy, brýle · tmavý tříkusový oblek s proužkem, fialová kravata |
| jenny | Jenny Griffith | dlouhé tmavé vlasy · petrolejové přiléhavé šaty s páskem |
| trevor | Trevor Evans | rozcuchané hnědé vlasy · riflová bunda, šedé tričko, rifle |
| tanner | Travis Tanner | tmavé vlasy, brýle · šedý oblek, levandulová kravata |
| benjamin | Benjamin | tmavé vlasy, brýle · šedá pletená vesta, košile, kravata |
| katrina | Katrina Bennett | vlnité blond vlasy · krémová halenka, široké kalhoty s proužkem |
| gretchen | Gretchen Bodinski | krátké šedé kudrnaté vlasy, starší · královsky modrý kostým, zlatý náhrdelník |
| alex | Alex Williams | krátké černé vlasy, plnovous · krémová košile, hnědé šle, vínová kravata |
| robert | Robert Zane | krátké černé vlasy, plnovous · velbloudí kabát přes tmavomodrý tříkusový oblek |
| samantha | Samantha Wheeler | dlouhé tmavé vlasy · vínový kalhotový kostým, krémová halenka |
| edith | Edith Ross | šedé vlasy, starší dáma · béžový šál, švestkové šaty |
| stu | Stu Buzzini | tmavé vlasy, brýle · kostkovaná košile, vínová kravata, visačka |
| moore | soudkyně Moore | šedé vlasy · černý soudcovský talár s vínovým pruhem, bílý límec |
| esther | Esther Litt | dlouhé tmavé kudrnaté vlasy · riflová bunda, rifle, khaki taška přes rameno |
| gallo | Frank Gallo | rozcuchané hnědé vlasy, zavalitý · olivová bunda, povolená kravata |
| oliver | Oliver Grady | hnědé vlasy · hnědá bunda, šedé tričko, rifle |
| logan | Logan Sanders | tmavé kudrnaté vlasy · bílé tenisové polo a šortky |
| tara | Tara Messer | tmavé vlasy v drdolu · černá bunda, sluchátka kolem krku, cargo kalhoty |
| marcus | Marcus Specter | tmavé vlasy, kšiltovka · červená bunda s kapucí, batoh kurýra |
| sheila | Sheila Sazs | dlouhé zrzavé vlasy · krémová halenka, švestková sukně |
| ava | Ava Hessington | tmavý mikádo účes · vínový kalhotový kostým |
| soloff | Jack Soloff | prořídlé vlasy, zavalitý · tmavomodrá vesta, vyhrnuté rukávy, šedá kravata, řetízek od hodinek |

---

## 4. Hotové prompty pro Codex

Do každého promptu doplň hranaté závorky. Vždy přilož `office.png` a stojící postavu.

### 4.1 Sedící zezadu (jedna postava)

```
Using the attached character as the exact reference (same person, same hair, same clothes and colours) and the attached
office image as the reference for camera angle, lighting and art style:

Draw [NAME] seated at an office desk, seen FROM BEHIND and slightly from above (the same elevated three-quarter
top-down camera as the office image, looking down about 35-40 degrees). We see the back and top of the head (hair),
the neck, the shoulders and the back of the [JACKET/TOP], the elbows slightly out to the sides, forearms reaching
forward to a keyboard and mostly hidden by the body. Crop from the top of the head down to the seat (hips).
Do NOT draw a chair, desk, keyboard, floor or shadow. Do not draw items the reference holds in their hands.

Style: identical to the reference character — stylised low-poly 3D with soft painterly shading, realistic adult
proportions, warm key light from the upper left, soft fill from the right.
Transparent background with a clean alpha edge (no coloured fringe, no noise, no checkerboard). PNG, the figure
about 360 px tall, centred, 5-10% padding. Head size identical to the reference at the same scale.
```

### 4.2 Harvey čelem

```
Using the attached Harvey Specter reference (same face, hair, navy suit, white shirt, navy tie, pocket square) and the
attached office image for camera, light and style:

Draw Harvey seated FACING the viewer, upright and confident, leaning back slightly, forearms resting forward as if on a
desk edge, seen from the same elevated three-quarter top-down camera as the office image. Show him from the top of the
head down to mid-thigh. Do NOT draw the chair, desk or floor — he will be placed into the chair already painted in the
office. Keep the pose symmetric and centred so it fits a high-back executive chair.
Same art style as the reference: stylised low-poly 3D, soft painterly shading, warm key light from the upper left.
Transparent background, clean alpha, no shadow, 600 x 600 px PNG.
```
Varianty: `harvey-ask` (*„…raising his right hand toward the viewer as if asking a question, looking straight at the viewer…“*), `harvey-type` (*„…looking down to his left at a monitor, both hands on a keyboard…“*).

### 4.3 Donna čelem

```
Using the attached Donna Paulsen reference (same face, long wavy auburn hair, plum fitted dress) and the attached office
image for camera, light and style:

Draw Donna seated FACING the viewer behind a reception desk (do not draw the desk), holding a phone to her ear with one
hand, a knowing half-smile, seen from the same elevated three-quarter top-down camera as the office image. From the top
of the head down to mid-thigh. Do NOT draw the chair, desk or floor. Centred, symmetric seated posture.
Same art style as the reference: stylised low-poly 3D, soft painterly shading, warm key light from the upper left.
Transparent background, clean alpha, no shadow, 600 x 600 px PNG.
```
Varianta `donna-type`: *„…both hands on a keyboard, looking down at a screen…“*.

### 4.4 Chůze (dvě fáze)

```
Using the attached character as the exact reference, draw the same person walking toward the viewer in a slight
three-quarter turn, mid-stride: [LEFT foot forward and RIGHT arm forward | RIGHT foot forward and LEFT arm forward].
Same camera, scale, style, lighting and clothing as the reference. Full body, feet on the same baseline as the
reference standing pose. Transparent background, clean alpha, no shadow, PNG about 600 px tall, centred.
```

---

## 5. Kontrola před odesláním

- [ ] Každá postava je ve vlastním souboru a název odpovídá tabulce (`seat-back/rachel.png`, …).
- [ ] Pozadí je opravdu průhledné. Zkontroluj na černém i bílém podkladu, že kolem postavy není lem ani šum.
- [ ] Sedící zezadu jsou opravdu **zezadu** (není vidět obličej) a nemají židli ani stůl.
- [ ] Harvey a Donna jsou **čelem**, bez židle a bez stolu.
- [ ] Vlasy a oblečení odpovídají stojící postavě.
- [ ] Hlavy mají ve všech souborech stejnou velikost.
- [ ] Všechno pošli zabalené ve stejné struktuře složek: `seat-back/`, `seat-front/`, `walk/` (a případně `standing/`).

Díky! 🙏
