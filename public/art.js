// Office art: everything is drawn in code (SVG strings). Pure definitions, no side effects.
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const BASE_AGENTS=[{id:'researcher',char:'rachel',name:'Rachel Zane',title:'Výzkumnice'},{id:'designer',char:'louis',name:'Louis Litt',title:'Designér'},{id:'tester',char:'mike',name:'Mike Ross',title:'Tester'}];
const BOSS_AGENT={id:'boss',char:'harvey',name:'Harvey Specter',title:'Šéf'};
function cooler(x,y){return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="4" rx="24" ry="7" fill="#5a3510" opacity=".28" filter="url(#soft)"/>
<rect x="-17" y="-48" width="34" height="50" rx="6" fill="#eef3f6"/><rect x="-17" y="-48" width="34" height="50" rx="6" fill="none" stroke="#b8c6cf" stroke-width="1.5"/><circle cx="-6" cy="-30" r="3" fill="#3b82c4"/><circle cx="6" cy="-30" r="3" fill="#e5484d"/><rect x="-8" y="-22" width="16" height="4" rx="2" fill="#b8c6cf"/>
<rect x="-14" y="-92" width="28" height="44" rx="12" fill="#8fd0f5" opacity=".75"/><rect x="-14" y="-92" width="28" height="44" rx="12" fill="none" stroke="#5aa9d6" stroke-width="1.5"/><rect x="-10" y="-84" width="5" height="22" rx="2.5" fill="#fff" opacity=".5"/>
<circle class="bub" cx="-2" cy="-58" r="2" fill="#fff"/><circle class="bub b2" cx="4" cy="-62" r="1.6" fill="#fff"/></g>`}
const props={
 researcher:`<g transform="translate(-58,16)"><rect x="-14" y="0" width="30" height="6" rx="1.5" fill="#d9544d"/><rect x="-12" y="-6" width="27" height="6" rx="1.5" fill="#4a7fc1"/><rect x="-10" y="-12" width="24" height="6" rx="1.5" fill="#e9b23e"/></g>
 <g class="paper"><rect x="-26" y="-14" width="52" height="50" rx="2" fill="#f8f3e4" stroke="#cdbf9c"/><rect x="-21" y="-9" width="42" height="8" fill="#3a2a1a" opacity=".75"/><path d="M-21 6H21M-21 12H21M-21 18H6M-21 24H21M-21 30H12" stroke="#8a7a60" stroke-width="2"/><rect x="8" y="14" width="13" height="12" fill="#9ad6ff"/></g>`,
 designer:`<g transform="translate(-60,14)"><ellipse cx="0" cy="0" rx="22" ry="10" fill="#f6ead2" stroke="#c9a56a"/><circle cx="-10" cy="-2" r="3.2" fill="#e5484d"/><circle cx="-2" cy="-4" r="3.2" fill="#f0a020"/><circle cx="7" cy="-2" r="3.2" fill="#3b82c4"/><circle cx="12" cy="4" r="3.2" fill="#3aa876"/></g>
 <g transform="translate(-26,22) rotate(-18)"><rect x="-14" y="-1.5" width="28" height="3" rx="1.5" fill="#444"/><rect x="8" y="-1.5" width="6" height="3" fill="#e5484d"/></g>`,
 copywriter:`<g transform="translate(-60,12)"><rect x="-16" y="-2" width="30" height="24" rx="2" fill="#fffdf6" stroke="#cdbf9c" transform="rotate(-6)"/><path d="M-10 6H8M-10 11H8M-10 16H2" stroke="#7a9acb" stroke-width="1.6" transform="rotate(-6)"/></g>
 <g transform="translate(-100,0)" opacity="0"></g><g transform="translate(-30,24)"><rect x="-8" y="-9" width="16" height="13" rx="3" fill="#fffaf0" stroke="#c9a56a"/><path d="M8 -6 q6 2 0 8" stroke="#c9a56a" stroke-width="2" fill="none"/><ellipse cx="0" cy="-8" rx="6.5" ry="2" fill="#6b3f1f"/><path class="steam" d="M-2 -12 q-3 -4 0 -8" stroke="#fff" stroke-width="1.6" fill="none"/><path class="steam s2" d="M3 -12 q-3 -4 0 -8" stroke="#fff" stroke-width="1.6" fill="none"/></g>`,
 tester:`<g transform="translate(-52,12)"><g class="lens"><circle cx="0" cy="0" r="11" fill="#cfeefa" fill-opacity=".6" stroke="#7a4b24" stroke-width="3.5"/><path d="M-5 -4 Q-2 -8 3 -7" stroke="#fff" stroke-width="2" fill="none"/><path d="M8 8 L20 20" stroke="#7a4b24" stroke-width="5" stroke-linecap="round"/></g></g>
 <g transform="translate(54,-20)"><ellipse cx="0" cy="0" rx="6" ry="5" fill="#e5484d"/><path d="M0 -5V5" stroke="#222" stroke-width="1"/><circle cx="-2.5" cy="-1" r="1" fill="#222"/><circle cx="2.5" cy="1.5" r="1" fill="#222"/></g>`,
 boss:`<g transform="translate(-60,6)"><rect x="-3" y="-6" width="6" height="14" fill="#444"/><path d="M-12 -6 L2 -24 L16 -14 Z" fill="#e9c27e"/><circle cx="2" cy="-24" r="2" fill="#444"/></g><g transform="translate(-28,24)"><rect x="-8" y="-9" width="16" height="13" rx="3" fill="#fffaf0" stroke="#c9a56a"/><path d="M8 -6 q6 2 0 8" stroke="#c9a56a" stroke-width="2" fill="none"/><ellipse cx="0" cy="-8" rx="6.5" ry="2" fill="#6b3f1f"/><path class="steam" d="M-2 -12 q-3 -4 0 -8" stroke="#fff" stroke-width="1.6" fill="none"/></g>`};
const badges=(y,x=0)=>`<g transform="translate(${x},${y})"><g class="badge b-q"><path d="M-17 -12 H17 Q22 -12 22 -7 V9 Q22 14 17 14 H6 L0 22 L-4 14 H-17 Q-22 14 -22 9 V-7 Q-22 -12 -17 -12Z" fill="#f0a020" stroke="#fff" stroke-width="2.5"/><text y="7" text-anchor="middle" font-size="19" font-weight="800" fill="#fff" font-family="ui-rounded,system-ui,sans-serif">?</text></g></g>
<g transform="translate(${x},${y})"><g class="badge b-ok"><circle r="14" fill="#3aa876" stroke="#fff" stroke-width="2.5"/><path d="M-6.5 0 L-1.5 5.5 L7 -5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>
<g transform="translate(${x},${y})"><g class="badge b-bad"><circle r="14" fill="#e5484d" stroke="#fff" stroke-width="2.5"/><text y="6.5" text-anchor="middle" font-size="19" font-weight="800" fill="#fff" font-family="ui-rounded,system-ui,sans-serif">!</text></g></g>`;


const frameS=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c9a24e"/><rect x="${x+3}" y="${y+3}" width="${w-6}" height="${h-6}" fill="#f2eee3"/><path d="M${x+8} ${y+h*.35} H${x+w-8} M${x+8} ${y+h*.55} H${x+w-8} M${x+8} ${y+h*.75} H${x+w*.6}" stroke="#8a8272" stroke-width="1.4"/>`;
const artS=(x,y,w,h)=>`<rect x="${x-4}" y="${y-4}" width="${w+8}" height="${h+8}" fill="#c9a24e"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0f1420"/><path d="M${x} ${y+h} L${x+w*.3} ${y+h*.3} L${x+w*.55} ${y+h*.7} L${x+w*.8} ${y+h*.2} L${x+w} ${y+h*.6} V${y+h}Z" fill="#c9a24e" opacity=".85"/><circle cx="${x+w*.8}" cy="${y+h*.22}" r="5" fill="#f2eee3" opacity=".8"/>`;
const lawShelf=(x,y,w,h)=>{let b='';const cols=['#5a1f2a','#1f3a5a','#2f4a3a','#4a3a24','#3a2a4a','#6a5a2a'];for(let r=0;r<3;r++){const sy=y+8+r*(h-12)/3;let cx=x+8,i=r*2;while(cx<x+w-14){const bw=6+((i*5)%4),bh=20+((i*7)%8);b+=`<rect x="${cx}" y="${sy+(h-12)/3-4-bh}" width="${bw}" height="${bh}" fill="${cols[i%cols.length]}"/><rect x="${cx}" y="${sy+(h-12)/3-4-bh+4}" width="${bw}" height="1.5" fill="#c9a24e" opacity=".8"/>`;cx+=bw+1;i++}b+=`<rect x="${x+4}" y="${sy+(h-12)/3-4}" width="${w-8}" height="4" fill="#2a1c14"/>`}
 return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3a271b"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" fill="#1d130d"/>${b}`};
const sconce=(x,y)=>`<circle cx="${x}" cy="${y+8}" r="34" fill="url(#lampG)"/><rect x="${x-5}" y="${y-6}" width="10" height="18" rx="4" fill="#e8c874"/><rect x="${x-8}" y="${y+12}" width="16" height="3" fill="#c9a24e"/>`;
const plantS=(x,y,s=1)=>`<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="3" rx="24" ry="7" fill="#000" opacity=".3" filter="url(#soft)"/><path d="M0 -26 V-60" stroke="#4a3a28" stroke-width="3"/><g class="sway"><circle cx="-14" cy="-68" r="15" fill="#2f5d3c"/><circle cx="14" cy="-70" r="16" fill="#38704a"/><circle cx="0" cy="-84" r="16" fill="#43805a"/></g><path d="M-16 -28 H16 L12 2 H-12Z" fill="#12151b"/><rect x="-18" y="-32" width="36" height="6" rx="2" fill="#262b35"/><rect x="-18" y="-32" width="36" height="1.6" fill="#c9a24e"/></g>`;
const sofaS=(x,y)=>`<g transform="translate(${x},${y})"><ellipse cx="0" cy="8" rx="78" ry="10" fill="#000" opacity=".3" filter="url(#soft)"/><rect x="-70" y="-44" width="140" height="42" rx="10" fill="#1a1613"/><rect x="-78" y="-26" width="22" height="34" rx="8" fill="#14110f"/><rect x="56" y="-26" width="22" height="34" rx="8" fill="#14110f"/><rect x="-56" y="-24" width="112" height="28" rx="8" fill="#2b231d"/><path d="M-28 -22V4M0 -22V4M28 -22V4" stroke="#14110f" stroke-width="1.5"/><rect x="-56" y="-24" width="112" height="3" fill="#fff" opacity=".08"/></g>`;

/* ---------- people (Suits-inspired personas, stylised – no likeness claims, no logos) ---------- */
const P={
 harvey:{skin:'#e2ae88',hair:'#17120f',iris:'#5a3a22',suit:'#1d2b47',vest:'#27395e',shirt:'#f5f5f1',tie:'#6d1f2c',pants:'#18233a',style:'slick',kind:'three',pocket:true,w:1},
 rachel:{skin:'#f2cdaa',hair:'#3f2518',iris:'#5a3a22',suit:'#272b36',shirt:'#f4eee6',pants:'#272b36',style:'longwave',kind:'fem',lips:'#b24a5a',w:.94},
 louis:{skin:'#efc3a0',hair:'#8a4a28',iris:'#6a4a2a',suit:'#4a5654',vest:'#58665f',shirt:'#f3f3ee',tie:'#c9a24e',pants:'#3f4a48',style:'balding',kind:'three',pocket:true,w:1.08},
 donna:{skin:'#f1c8a6',hair:'#b4391f',iris:'#4f8a62',suit:'#1e3b35',shirt:'#1e3b35',pants:'#1e3b35',style:'redwaves',kind:'dress',lips:'#a3202e',w:.95},
 mike:{skin:'#e8bd98',hair:'#58381f',iris:'#4a7fa8',suit:'#303949',shirt:'#f6f6f2',tie:'#2f5f8a',pants:'#2a313e',style:'short',kind:'two',w:.97},
 jessica:{skin:'#8a5a3e',hair:'#1a1210',iris:'#3a2618',suit:'#efe9df',shirt:'#efe9df',pants:'#efe9df',style:'updo',kind:'dress',lips:'#8a2a3a',w:.95},
 harold:{skin:'#f3d2b4',hair:'#9a4a22',iris:'#4a7fa8',suit:'#7a7f88',shirt:'#f3f3ee',tie:'#5a6a3a',pants:'#6a6f78',style:'curly',kind:'two',w:.96},
 norma:{skin:'#f0cfb4',hair:'#b9b4ac',iris:'#5a4a3a',suit:'#7a5a6a',shirt:'#efe6e0',pants:'#4a3a44',style:'grayBun',kind:'fem',lips:'#9a4a5a',glasses:true,w:.98},
 kyle:{skin:'#f2cfae',hair:'#d9b56a',iris:'#4a7fa8',suit:'#22304e',shirt:'#f6f6f2',tie:'#8a2a2a',pants:'#1c2840',style:'short',kind:'two',w:1},
 scottie:{skin:'#f1cdb0',hair:'#a8693a',iris:'#3a6a8a',suit:'#16181d',shirt:'#e8e2da',pants:'#16181d',style:'longwave',kind:'fem',lips:'#a83a4a',w:.94},
 hardman:{skin:'#e6b996',hair:'#b8b8b4',iris:'#4a4a4a',suit:'#2a2c31',vest:'#33363c',shirt:'#f3f3ee',tie:'#3a4a6a',pants:'#24262b',style:'slick',kind:'three',w:1.02},
 jenny:{skin:'#f2cdb0',hair:'#6a3e22',iris:'#4f6a3a',suit:'#a8c4d8',shirt:'#a8c4d8',pants:'#3a4250',style:'longwave',kind:'dress',lips:'#b24a5a',w:.93},
 trevor:{skin:'#e8bb98',hair:'#2a1c14',iris:'#4a3a2a',suit:'#5a3a26',shirt:'#3a4250',pants:'#2a3038',style:'messy',kind:'casual',w:.98},
 tanner:{skin:'#e2b08e',hair:'#2a2420',iris:'#4a3a2a',suit:'#121318',shirt:'#f3f3ee',tie:'#121318',pants:'#121318',style:'slick',kind:'two',w:1.03},
 guest:{skin:'#d9a98a',hair:'#38342f',iris:'#4a3a2a',suit:'#5a6270',shirt:'#e8ecef',pants:'#454c57',style:'short',kind:'casual',w:1}
};
const BASE_CHAR={boss:'harvey',researcher:'rachel',designer:'louis',tester:'mike'};
const GESTURE={harvey:'boss',louis:'tie',donna:'chin',mike:'pen',rachel:'page',jessica:'chin',harold:'pen',norma:'page',kyle:'tie',scottie:'chin',hardman:'boss',jenny:'page',trevor:'pen',tanner:'boss',guest:'none'};
const PAL_S=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,{skin:v.skin,hair:v.hair,shirt:v.suit,chair:'#14171d'}]));

function hairBack(q){const h=q.hair;return {
 longwave:`<path d="M-16 -74 Q-21 -46 -12 -33 Q-6 -39 0 -37 Q6 -39 12 -33 Q21 -46 16 -74Z" fill="${h}"/><path d="M-14 -60 Q-17 -44 -11 -36 M14 -60 Q17 -44 11 -36" stroke="#fff" stroke-opacity=".12" stroke-width="1.4" fill="none"/>`,
 redwaves:`<path d="M-18 -78 Q-26 -48 -13 -36 Q-6 -42 0 -40 Q6 -42 13 -36 Q26 -48 18 -78Z" fill="${h}"/><path d="M-17 -64 Q-21 -48 -13 -39 M17 -64 Q21 -48 13 -39" stroke="#e0603a" stroke-opacity=".5" stroke-width="1.6" fill="none"/>`}[q.style]||''}
function hairFront(q){const h=q.hair;return {
 slick:`<path d="M-13.8 -70 Q-16 -91 0 -91 Q16 -91 13.8 -70 Q13 -81 4 -84 Q-7 -86 -13.8 -70Z" fill="${h}"/><path d="M-9 -86 Q0 -90 9 -85 M-11 -80 Q-2 -86 8 -82" stroke="#fff" stroke-opacity=".28" stroke-width="1.2" fill="none"/>`,
 longwave:`<path d="M-13.8 -70 Q-16 -91 2 -90 Q17 -89 13.8 -70 Q10 -84 -3 -83 Q-11 -80 -13.8 -70Z" fill="${h}"/><path d="M-4 -88 Q4 -90 10 -84" stroke="#fff" stroke-opacity=".18" stroke-width="1.2" fill="none"/>`,
 balding:`<path d="M-13.5 -68 Q-15 -78 -10 -83 L-9 -70Z M13.5 -68 Q15 -78 10 -83 L9 -70Z" fill="${h}"/><path d="M-8 -87 Q0 -90 8 -87 Q0 -88.5 -8 -87Z" fill="${h}" opacity=".8"/><ellipse cx="0" cy="-84" rx="9" ry="2" fill="#fff" opacity=".18"/>`,
 redwaves:`<path d="M-15 -69 Q-20 -96 0 -94 Q20 -96 15 -69 Q13 -85 3 -85 Q-8 -86 -15 -69Z" fill="${h}"/><path d="M-12 -88 Q-4 -93 6 -90 M-15 -78 Q-14 -86 -8 -88" stroke="#ff8a5a" stroke-opacity=".45" stroke-width="1.4" fill="none"/>`,
 updo:`<path d="M-13.8 -70 Q-15 -90 0 -90 Q15 -90 13.8 -70 Q12 -82 0 -84 Q-12 -82 -13.8 -70Z" fill="${h}"/><ellipse cx="0" cy="-93" rx="9" ry="6" fill="${h}"/><path d="M-6 -95 Q0 -98 6 -95" stroke="#fff" stroke-opacity=".2" fill="none"/>`,
 curly:`${[[-11,-80],[-6,-86],[1,-88],[8,-85],[12,-78],[-13,-72],[13,-71]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5.6" fill="${h}"/>`).join('')}`,
 grayBun:`<path d="M-13.8 -70 Q-15 -88 0 -88 Q15 -88 13.8 -70 Q10 -81 0 -81 Q-10 -81 -13.8 -70Z" fill="${h}"/><circle cx="0" cy="-91" r="6" fill="${h}"/>`,
 messy:`<path d="M-13.5 -70 Q-16 -90 0 -91 Q16 -90 13.5 -70 L11 -80 L7 -84 L3 -79 L-2 -85 L-6 -79 L-10 -83Z" fill="${h}"/>`,
 short:`<path d="M-13.5 -70 Q-15 -89 0 -89 Q15 -89 13.5 -70 Q12 -80 4 -81 Q-3 -84 -8 -80 Q-12 -78 -13.5 -70Z" fill="${h}"/><path d="M-6 -86 Q2 -90 9 -85" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" fill="none"/>`}[q.style]||''}

function charS(ch,T){
 const q=P[ch]||P.guest;const role=ch;const fem=q.kind==='fem'||q.kind==='dress';
 const S=q.suit, sh='#000';
 // --- torso/jacket by kind
 let body=`<path d="M-36 14 V-26 Q-36 -53 -12 -55 H12 Q36 -53 36 -26 V14Z" fill="${S}"/><path d="M8 -55 Q36 -53 36 -26 V14 H14Z" fill="${sh}" opacity=".2"/><path d="M-36 -26 Q-36 -53 -12 -55" stroke="#fff" stroke-opacity=".1" stroke-width="2" fill="none"/>`;
 let front='';
 if(q.kind==='three'){front=`<path d="M-11 -53 L0 -33 L11 -53 L15 2 H-15Z" fill="${q.vest}"/><path d="M-11 -53 L0 -33 L11 -53 L7 -49 L0 -38 L-7 -49Z" fill="${q.shirt}"/>${[-22,-14,-6].map(y=>`<circle cx="0" cy="${y}" r="1.2" fill="#d6b45a"/>`).join('')}<path d="M-11 -53 L-2 -31 L-18 -18 L-26 -44Z M11 -53 L2 -31 L18 -18 L26 -44Z" fill="#000" opacity=".24"/><path d="M-11 -53 L-2 -31 L-18 -18" stroke="#fff" stroke-opacity=".14" fill="none"/><path d="M11 -53 L2 -31 L18 -18" stroke="#fff" stroke-opacity=".14" fill="none"/><path d="M-3 -47 H3 L4.2 -42 L0 -40 L-4.2 -42Z" fill="${q.tie}"/><path d="M-2.6 -41 H2.6 L3.8 -20 L0 -16 L-3.8 -20Z" fill="${q.tie}"/><path d="M-2.6 -41 L0 -38 L2.6 -41" stroke="#000" stroke-opacity=".25" fill="none"/>${q.pocket?'<path d="M17 -34 L27 -37 L26 -29 L17 -28Z" fill="#f7f6f0"/><path d="M19 -34 L22 -37 L25 -34" fill="#c9a24e" opacity=".8"/>':''}${ch==='louis'?'<circle cx="0" cy="-30" r=".9" fill="#c9a24e"/><path d="M-2 -33 l1 1 M1 -27 l1 1 M-1 -23 l1 1" stroke="#c9a24e" stroke-width="1" opacity=".9"/>':''}`}
 else if(q.kind==='two'||q.kind==='casual'){front=`<path d="M-9 -53 L0 -34 L9 -53Z" fill="${q.shirt}"/><path d="M-9 -53 L-2 -29 L-16 -19 L-24 -44Z M9 -53 L2 -29 L16 -19 L24 -44Z" fill="#000" opacity=".26"/><path d="M-9 -53 L-2 -29 L-16 -19" stroke="#fff" stroke-opacity=".14" fill="none"/>${q.tie?`<path d="M-2.4 -47 H2.4 L3.4 -42 L0 -40 L-3.4 -42Z" fill="${q.tie}"/><path d="M-2.2 -41 H2.2 L3.2 -22 L0 -18 L-3.2 -22Z" fill="${q.tie}"/>`:''}<circle cx="-3" cy="-17" r="1" fill="#000" opacity=".4"/>`}
 else if(q.kind==='fem'){front=`<path d="M-11 -53 L0 -36 L11 -53 L8 -56 H-8Z" fill="${q.shirt}"/><path d="M-11 -53 L-3 -26 L-18 -16 L-27 -44Z M11 -53 L3 -26 L18 -16 L27 -44Z" fill="#000" opacity=".22"/><path d="M-11 -53 L-3 -26 L-18 -16" stroke="#fff" stroke-opacity=".12" fill="none"/><path d="M-6 -49 Q0 -41 6 -49" stroke="#d6b45a" stroke-width="1.3" fill="none"/><circle cx="0" cy="-41" r="1.6" fill="#d6b45a"/>`}
 else if(q.kind==='dress'){front=`<path d="M-12 -54 Q0 -30 12 -54 L9 -56 H-9Z" fill="${q.skin}"/><path d="M-12 -54 Q0 -28 12 -54" stroke="#000" stroke-opacity=".15" fill="none"/><path d="M-5 -46 Q0 -38 5 -46" stroke="#d6b45a" stroke-width="1.3" fill="none"/><circle cx="0" cy="-38" r="1.6" fill="#d6b45a"/><path d="M-30 -20 H30" stroke="#fff" stroke-opacity=".08" stroke-width="1"/><rect x="-14" y="-6" width="28" height="3" rx="1.5" fill="#d6b45a" opacity=".9"/>`}
 const stubs=`<path class="stubL" d="M-36 -34 Q-44 -6 -40 24 H-30 Q-31 -6 -28 -36Z" fill="${S}"/><path class="stubR" d="M36 -34 Q44 -6 40 24 H30 Q31 -6 28 -36Z" fill="${S}"/>`;
 const legs=`<g class="legs"><g class="legL"><rect x="-17" y="12" width="14" height="46" rx="6" fill="${q.pants}"/><path d="M-19 54 h18 q2 0 2 3 v3 h-22 v-3 q0 -3 2 -3z" fill="#120d0a"/></g><g class="legR"><rect x="3" y="12" width="14" height="46" rx="6" fill="${q.pants}"/><path d="M1 54 h18 q2 0 2 3 v3 h-22 v-3 q0 -3 2 -3z" fill="#120d0a"/></g></g>`;
 const lips=fem?q.lips:'#7a3d30';
 const head=`<g class="head">${hairBack(q)}<rect x="-6" y="-60" width="12" height="13" fill="${q.skin}"/><path d="M-6 -52 Q0 -46 6 -52 V-47 H-6Z" fill="#000" opacity=".16"/>
  <ellipse cx="-12.6" cy="-69" rx="2.6" ry="3.6" fill="${q.skin}"/><ellipse cx="12.6" cy="-69" rx="2.6" ry="3.6" fill="${q.skin}"/><path d="M-12.8 -70.5 q1 1.5 0 3 M12.8 -70.5 q-1 1.5 0 3" stroke="#000" stroke-opacity=".2" fill="none"/>
  <ellipse cx="0" cy="-70" rx="12.5" ry="15" fill="${q.skin}"/><path d="M4 -84 Q14 -78 12 -62 Q8 -55 3 -55 Q9 -68 4 -84Z" fill="#000" opacity=".1"/><path d="M-8 -57 Q0 -53 8 -57" stroke="#000" stroke-opacity=".1" fill="none"/>
  ${hairFront(q)}
  <g class="eyes"><ellipse cx="-5" cy="-71" rx="2.2" ry="2.3" fill="#fff"/><ellipse cx="5" cy="-71" rx="2.2" ry="2.3" fill="#fff"/><circle cx="-4.6" cy="-71" r="1.35" fill="${q.iris}"/><circle cx="5.4" cy="-71" r="1.35" fill="${q.iris}"/><circle cx="-4.6" cy="-71" r=".6" fill="#120c08"/><circle cx="5.4" cy="-71" r=".6" fill="#120c08"/><circle cx="-4.1" cy="-71.6" r=".35" fill="#fff"/><circle cx="5.9" cy="-71.6" r=".35" fill="#fff"/>${fem?'<path d="M-7.4 -72.6 Q-5 -74.4 -2.6 -72.8 M2.6 -72.8 Q5 -74.4 7.4 -72.6" stroke="#120c08" stroke-width=".9" fill="none"/>':''}</g>
  ${q.glasses?'<g fill="none" stroke="#2a2a30" stroke-width="1.3"><rect x="-10" y="-74.5" width="8.6" height="6.6" rx="2.4"/><rect x="1.4" y="-74.5" width="8.6" height="6.6" rx="2.4"/><path d="M-1.4 -72H1.4"/></g>':''}
  <path d="M-8 -75.5 Q-5 -77 -2.4 -75.8 M2.4 -75.8 Q5 -77 8 -75.5" stroke="${q.hair}" stroke-width="${fem?1.1:1.6}" fill="none" stroke-linecap="round"/>
  <path d="M0 -71 Q2 -66.5 -.4 -65.6" stroke="#000" stroke-opacity=".28" stroke-width="1" fill="none"/>
  ${fem?'<circle cx="-8.5" cy="-65.5" r="2.6" fill="#e8806a" opacity=".16"/><circle cx="8.5" cy="-65.5" r="2.6" fill="#e8806a" opacity=".16"/>':''}
  <path class="mouth" d="M-3.6 -61.2 Q0 -59.4 3.6 -61.2" stroke="${lips}" stroke-width="${fem?1.9:1.4}" fill="none" stroke-linecap="round"/>
  <path class="mouth-big" d="M-5 -61.6 Q0 -55.5 5 -61.6Z" fill="${lips}"/><ellipse class="mouth-o" cx="0" cy="-60" rx="2" ry="2.7" fill="${lips}"/>
  <ellipse class="glow" cx="0" cy="-68" rx="26" ry="22" fill="url(#glowg)" style="mix-blend-mode:screen"/></g>`;
 return `<g class="rig">${legs}<g class="torso"><g transform="scale(${q.w},1)">${stubs}${body}${front}</g>${head}</g></g>`}

function armsS(ch,T){const q=P[ch]||P.guest;const arm=(sx)=>{const S=[27*sx,-38],E=[37*sx,-6],H=[17*sx,13];const sl=q.suit;
 return `<g class="arm ${sx<0?'armL':'armR'}"><g class="ua"><path d="M${S[0]} ${S[1]} Q${E[0]+3*sx} ${-22} ${E[0]} ${E[1]}" stroke="${sl}" stroke-width="13.5" stroke-linecap="round" fill="none"/><path d="M${S[0]} ${S[1]} Q${E[0]+3*sx} ${-22} ${E[0]} ${E[1]}" stroke="#fff" stroke-opacity=".08" stroke-width="3" stroke-linecap="round" fill="none" transform="translate(${-3*sx} 0)"/>
  <g class="fa"><path d="M${E[0]} ${E[1]} Q${E[0]-4*sx} 8 ${H[0]} ${H[1]-3}" stroke="${sl}" stroke-width="12" stroke-linecap="round" fill="none"/><rect x="${H[0]-6}" y="${H[1]-11}" width="12" height="4" rx="1.5" fill="${q.kind==='dress'?q.skin:q.shirt}" transform="rotate(${-18*sx} ${H[0]} ${H[1]-9})"/><circle cx="${H[0]-3.5*sx}" cy="${H[1]-8}" r="1" fill="#d6b45a"/>
   <ellipse cx="${H[0]}" cy="${H[1]}" rx="6.4" ry="5" fill="${q.skin}"/><path d="M${H[0]-4} ${H[1]+3} h8 M${H[0]-3} ${H[1]+4.6} h6" stroke="#000" stroke-opacity=".25" stroke-width=".8"/><ellipse cx="${H[0]+5.5*sx}" cy="${H[1]-1}" rx="2" ry="3.2" fill="${q.skin}" transform="rotate(${25*sx} ${H[0]+5.5*sx} ${H[1]-1})"/></g></g></g>`};
 return arm(-1)+arm(1)}

/* ---------- scene pieces ---------- */
const winS=(x,y,w,h,night)=>{let b='';const n=Math.floor(w/12);for(let i=0;i<n;i++){const bh=h*(.26+((i*41)%55)/100),bw=w/n;b+=`<rect x="${x+i*bw}" y="${y+h-bh}" width="${bw-1.2}" height="${bh}" fill="${night?'#161f38':'#8f9fb5'}"/><rect x="${x+i*bw}" y="${y+h-bh}" width="${(bw-1.2)/2}" height="${bh}" fill="#000" opacity=".12"/>`;for(let k=0;k<4;k++)b+=`<rect x="${x+i*bw+2.2+(k%2)*4.2}" y="${y+h-bh+5+Math.floor(k/2)*9}" width="2.2" height="3" fill="${night?'#ffd08a':'#fff'}" opacity="${night?((i+k)%3?.9:.25):.55}"/>`}
 return `<rect x="${x-6}" y="${y-6}" width="${w+12}" height="${h+12}" fill="#c9a24e"/><rect x="${x-3}" y="${y-3}" width="${w+6}" height="${h+6}" fill="#11151f"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${night?'skyN':'skyS'})"/>${night?'<circle cx="'+(x+w*.2)+'" cy="'+(y+h*.22)+'" r="5" fill="#f4f1e0" opacity=".9"/>':'<circle cx="'+(x+w*.75)+'" cy="'+(y+h*.5)+'" r="'+h*.15+'" fill="#fff0c4" opacity=".85"/>'}${b}<rect x="${x+w/2-1.5}" y="${y}" width="3" height="${h}" fill="#c9a24e"/><path d="M${x} ${y+h*.15} L${x+w*.45} ${y} H${x+w*.6} L${x+w*.12} ${y+h}H${x}Z" fill="#fff" opacity=".07"/>`};

props.docs=`<g transform="translate(-58,14)"><rect x="-16" y="-6" width="30" height="22" rx="1.5" fill="#fffdf6" stroke="#cdbf9c" transform="rotate(-5)"/><rect x="-13" y="-9" width="30" height="22" rx="1.5" fill="#fffdf6" stroke="#cdbf9c" transform="rotate(4)"/><path d="M-8 -2h18M-8 3h18M-8 8h11" stroke="#8a9bb5" stroke-width="1.4" transform="rotate(4)"/></g><g transform="translate(-28,24)"><rect x="-8" y="-9" width="16" height="13" rx="3" fill="#fffaf0" stroke="#c9a56a"/><ellipse cx="0" cy="-8" rx="6.5" ry="2" fill="#6b3f1f"/></g>`;
props.guest=`<g transform="translate(-52,14)"><rect x="-18" y="-12" width="36" height="22" rx="2" fill="#2a2d33"/><rect x="-15" y="-9" width="30" height="16" rx="1" fill="#0f2a3a"/><path d="M-12 -4 h14 M-12 0 h20 M-12 4 h9" stroke="#6bd1a8" stroke-width="1.5"/><rect x="-22" y="10" width="44" height="3" rx="1.5" fill="#9aa0a8"/></g><g transform="translate(-26,24)"><rect x="-8" y="-9" width="16" height="13" rx="3" fill="#fffaf0" stroke="#c9a56a"/><ellipse cx="0" cy="-8" rx="6.5" ry="2" fill="#6b3f1f"/></g>`;

/* ---------- the office theme (Suits-inspired law firm); day/night follows the device ---------- */
/** Office layout for any number of agents. Desks fill a grid; the boss keeps the corner office. */
function officeLayout(kind,agents,withGuest){
 const ids=agents.map(a=>a.id);const slots=[...ids,'__plus',...(withGuest?['__guest']:[])];const spots={};let H;
 if(kind==='wide'){
  // row 0: two desks left of the glass office; then rows of four across the full width
  const row0=[[140,300],[352,300]];const cols=[120,360,600,840];
  slots.forEach((id,i)=>{let x,y;if(i<2){[x,y]=row0[i]}else{const k=i-2;x=cols[k%4];y=480+Math.floor(k/4)*180}spots[id]=[x,y,1]});
  const last=Math.max(...Object.values(spots).map(s=>s[1]));H=Math.max(580,last+100);
  return {kind,W:960,H,wall:150,room:{x:596,y:38,w:344,h:268,door:[742,806]},spots:{boss:[770,196,1.2],...spots},target:[774,330],agents}
 }
 const cols=[104,298];slots.forEach((id,i)=>{spots[id]=[cols[i%2],420+Math.floor(i/2)*170,.98]});
 const last=Math.max(...Object.values(spots).map(s=>s[1]));H=Math.max(790,last+100);
 return {kind,W:400,H,wall:120,room:{x:12,y:34,w:376,h:262,door:[170,232]},spots:{boss:[200,206,1.12],...spots},target:[200,326],agents}
}
const timing=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return [6+(h%30)/10,-((h>>5)%50)/10]};
const TS=(night)=>({id:night?'night':'day',night,pal:PAL_S,char:charS,arms:armsS,
 defs:`<defs>
 <linearGradient id="skyS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f9fd8"/><stop offset=".6" stop-color="#cfe3f5"/><stop offset="1" stop-color="#f6ead2"/></linearGradient>
 <linearGradient id="skyN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1126"/><stop offset=".7" stop-color="#1c2a52"/><stop offset="1" stop-color="#3a3f6a"/></linearGradient>
 <linearGradient id="wallS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night?'#141b2e':'#2a3a5c'}"/><stop offset="1" stop-color="${night?'#0d1220':'#1c2842'}"/></linearGradient>
 <linearGradient id="deskS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3326"/><stop offset="1" stop-color="#2a1a12"/></linearGradient>
 <linearGradient id="deskW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f4ee"/><stop offset="1" stop-color="#dcd8cd"/></linearGradient>
 <linearGradient id="woodDoor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a3022"/><stop offset=".5" stop-color="#5e3c2a"/><stop offset="1" stop-color="#3a2418"/></linearGradient>
 <pattern id="marble" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="${night?'#59606e':'#d8d4cb'}"/><rect width="32" height="32" fill="${night?'#525968':'#cfcac0'}"/><rect x="32" y="32" width="32" height="32" fill="${night?'#525968':'#cfcac0'}"/><path d="M0 .5H64M.5 0V64" stroke="#000" stroke-opacity=".22"/><path d="M6 50 Q22 38 30 44 T58 30" stroke="#fff" stroke-opacity=".4" fill="none"/><path d="M40 6 Q50 16 60 12" stroke="#000" stroke-opacity=".16" fill="none"/></pattern>
 <linearGradient id="floorShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient>
 <linearGradient id="glassD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dff0f6" stop-opacity=".3"/><stop offset="1" stop-color="#bcd9e6" stop-opacity=".1"/></linearGradient>
 <radialGradient id="glowg"><stop offset="0" stop-color="#9fe6ff" stop-opacity=".85"/><stop offset="1" stop-color="#9fe6ff" stop-opacity="0"/></radialGradient>
 <radialGradient id="lampG"><stop offset="0" stop-color="#ffd98a" stop-opacity=".85"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
 <radialGradient id="vig" cx=".5" cy=".45" r=".8"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0d1220" stop-opacity=".34"/></radialGradient>
 <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter></defs>`,
 fx:()=>'',
 chair:(role)=>`<rect x="-30" y="-68" width="60" height="80" rx="17" fill="#14171d"/><rect x="-24" y="-62" width="48" height="64" rx="12" fill="#fff" opacity=".08"/><path d="M-22 -58 Q0 -66 22 -58" stroke="#fff" stroke-opacity=".12" fill="none"/><rect x="-44" y="-14" width="10" height="28" rx="4" fill="#0c0e12"/><rect x="34" y="-14" width="10" height="28" rx="4" fill="#0c0e12"/>`,
 part:(role)=>role==='boss'?'':`<rect x="-100" y="-110" width="200" height="104" fill="#cfe0ee" opacity="${night?.12:.2}"/><rect x="-100" y="-110" width="200" height="104" fill="none" stroke="#9fb4c6" stroke-width="2" opacity=".7"/><rect x="-100" y="-114" width="200" height="5" fill="#8f98a3"/><rect x="-100" y="-110" width="3" height="104" fill="#8f98a3"/><rect x="97" y="-110" width="3" height="104" fill="#8f98a3"/><path d="M-90 -98 L-60 -70 M-80 -104 L-40 -66" stroke="#fff" stroke-opacity=".22" stroke-width="6"/>`,
 shadow:()=>`<ellipse cx="0" cy="52" rx="112" ry="20" fill="#000" opacity=".3" filter="url(#soft)"/><ellipse class="ring" cx="0" cy="62" rx="98" ry="13" fill="#3aa876" opacity="0"/>${night?'<ellipse cx="58" cy="-6" rx="150" ry="100" fill="url(#lampG)" style="mix-blend-mode:screen" opacity=".55"/>':''}`,
 desk:(label,gold,person)=>{const top=gold?'url(#deskS)':'url(#deskW)';return `<path d="M-90 0 H90 L100 36 H-100Z" fill="${top}"/><path d="M-90 0 H90" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><path d="M-60 6 L-30 30 M-40 4 L-6 32" stroke="#fff" stroke-opacity="${gold?.05:.45}" stroke-width="5"/>
  <rect x="-100" y="36" width="200" height="14" rx="2" fill="${gold?'#1a110c':'#c9c4b8'}"/><rect x="-100" y="36" width="200" height="2" fill="${gold?'#c9a24e':'#fff'}" opacity=".7"/><rect x="38" y="50" width="52" height="16" rx="2" fill="${gold?'#150d09':'#b8b3a6'}"/><rect x="-92" y="50" width="6" height="16" fill="#8f98a3"/>
  ${person?`<rect x="-40" y="39" width="80" height="21" rx="2" fill="#c9a24e"/><rect x="-38" y="41" width="76" height="17" rx="1" fill="none" stroke="#7a5f1f" stroke-width=".6"/><text x="0" y="49" text-anchor="middle" font-size="${person.length>13?7.4:8.6}" font-weight="800" fill="#241708" font-family="Georgia,'Times New Roman',serif">${esc(person)}</text><text x="0" y="56" text-anchor="middle" font-size="5.6" font-weight="700" fill="#4a3510" font-family="-apple-system,system-ui,sans-serif" letter-spacing="1.2">${esc(label)}</text>`:`<rect x="-34" y="40" width="68" height="10" rx="2" fill="#c9a24e"/><text x="0" y="47.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="#2a1c0a" font-family="-apple-system,system-ui,sans-serif" letter-spacing=".6">${esc(label)}</text>`}`},
 monitor:()=>`<g transform="translate(56,0)"><rect x="-3" y="-2" width="6" height="10" fill="#9aa0a8"/><rect x="-14" y="6" width="28" height="4" rx="2" fill="#9aa0a8"/><rect x="-28" y="-40" width="56" height="38" rx="3" fill="#c9ccd1"/><rect x="-28" y="-40" width="56" height="3" fill="#fff" opacity=".4"/><circle cx="0" cy="-21" r="3.5" fill="#8a9098" opacity=".6"/></g><rect x="-20" y="22" width="34" height="6" rx="2" fill="#2a2d33"/><g transform="translate(-72,12)"><rect x="-9" y="-8" width="18" height="12" rx="3" fill="#1a1d22"/><rect x="-5" y="-12" width="10" height="5" rx="2" fill="#2f343b"/></g>${night?'<g transform="translate(-84,-6)"><path d="M0 0 L12 -20 L22 -18" stroke="#9aa0a8" stroke-width="2.5" fill="none"/><path d="M14 -24 L32 -16 L24 -6Z" fill="#c9a24e"/></g>':''}`,
 plusColor:'#c9a24e',
 deco(L){return L.W>500?[[0,winS(50,26,150,90,night)],[0,winS(238,26,150,90,night)],[0,frameS(430,34,42,54)],[0,frameS(480,34,42,54)],[0,artS(540,36,46,50)],[0,sconce(214,60)],[0,sconce(410,60)],[230,cooler(486,246)],[L.H,plantS(16,L.H-6,.85)],[L.H,plantS(944,L.H-6,.85)]]
  :[[0,winS(24,8,100,52,night)],[0,winS(276,8,100,52,night)],[0,frameS(166,12,34,44)],[0,frameS(206,12,34,44)],[L.H,plantS(16,L.H-4,.7)],[L.H,plantS(384,L.H-4,.7)]]},
 bg(L){const W=L.W,H=L.H,fl=L.wall;let pan='';for(let x=0;x<W;x+=46)pan+=`<rect x="${x}" y="0" width="2" height="${fl-12}" fill="#2c3a58" opacity=".6"/>`;
  return `<rect width="${W}" height="${H}" fill="url(#marble)"/><rect width="${W}" height="${H}" fill="url(#floorShine)"/><rect width="${W}" height="${fl}" fill="url(#wallS)"/>${pan}<rect y="${fl-12}" width="${W}" height="12" fill="#0d121e"/><rect y="${fl-12}" width="${W}" height="2.5" fill="#c9a24e"/><rect y="6" width="${W}" height="2" fill="#c9a24e" opacity=".5"/><rect y="${fl}" width="${W}" height="16" fill="#000" opacity=".28" filter="url(#soft)"/>`},
 room(L,boss){const r=L.room,[d1,d2]=r.door;const P=`M${r.x} ${r.y}V${r.y+r.h}H${d1}M${d2} ${r.y+r.h}H${r.x+r.w}V${r.y}H${r.x}`;
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h*.42}" fill="#33231a"/>${Array.from({length:Math.floor(r.w/38)},(_,i)=>`<rect x="${r.x+i*38}" y="${r.y}" width="2" height="${r.h*.42}" fill="#1d130d" opacity=".6"/>`).join('')}
  ${L.W>500?`${lawShelf(r.x+14,r.y+10,78,r.h*.38)}${winS(r.x+r.w*.42,r.y+16,r.w*.42,r.h*.3,night)}`:`${winS(r.x+r.w*.38,r.y+14,r.w*.5,r.h*.26,night)}${lawShelf(r.x+12,r.y+8,86,r.h*.34)}`}
  <rect x="${r.x}" y="${r.y+r.h*.42}" width="${r.w}" height="${r.h*.58}" fill="#2a1e17"/><rect x="${r.x+26}" y="${r.y+r.h*.56}" width="${r.w-52}" height="${r.h*.36}" rx="6" fill="#1a2438"/><rect x="${r.x+26}" y="${r.y+r.h*.56}" width="${r.w-52}" height="${r.h*.36}" rx="6" fill="none" stroke="#c9a24e" stroke-width="2"/>${boss}
  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#glassD)"/><path d="M${r.x+24} ${r.y+r.h} L${r.x+96} ${r.y} H${r.x+120} L${r.x+48} ${r.y+r.h}Z" fill="#fff" opacity=".1"/>
  <path d="${P}" fill="none" stroke="#c9a24e" stroke-width="5" stroke-linejoin="round"/><path d="${P}" fill="none" stroke="#0d121e" stroke-width="1.5" stroke-linejoin="round"/>`},
 fg:(L)=>`<rect width="${L.W}" height="${L.H}" fill="url(#vig)" pointer-events="none"/>${night?`<rect width="${L.W}" height="${L.H}" fill="#0b1d3a" opacity=".3" style="mix-blend-mode:multiply" pointer-events="none"/>`:`<rect width="${L.W}" height="${L.H}" fill="#ffb867" opacity=".07" style="mix-blend-mode:screen" pointer-events="none"/>`}`
});
const THEMES={day:TS(false),night:TS(true)};

function zone(id,ch,x,y,s,T,info={}){
  const isBoss=id==='boss';const [per,dl]=timing(id);
  return `<g class="zone st-idle r-${id} g-${GESTURE[ch]||'none'} ${isBoss?'':'walker'}" data-role="${esc(id)}" data-x="${x}" data-y="${y}" data-s="${s}" transform="translate(${x},${y}) scale(${s})" style="--per:${per}s;--dl:${dl}s">
  ${T.shadow()}${T.part(id)}${T.chair(id)}
  <g class="mover" style="transform:translate(var(--dx,0px),var(--dy,0px))">${T.char(ch,T)}${isBoss?badges(-112):badges(-96,30)}</g>
  ${T.desk(String(info.title||'').toUpperCase(),isBoss,info.name)}${T.monitor()}${props[id]||props.docs}
  <g class="armsg">${T.arms(ch,T)}</g></g>`}
function plusZone(x,y,s,T,label='PŘIDAT ROLI'){return `<g class="zone" data-role="plus" transform="translate(${x},${y}) scale(${s})" tabindex="0" role="button" aria-label="Přidat roli" onclick="openRoleDlg()" onkeydown="if(event.key==='Enter'||event.key===' ')openRoleDlg()">
  ${T.shadow()}${T.part('plus')}<rect x="-30" y="-64" width="60" height="74" rx="14" fill="#5a6370" opacity=".55"/>
  ${T.desk(label)}
  <g class="plusbtn"><circle cx="0" cy="-34" r="30" fill="#fff8e8" fill-opacity=".9" stroke="${T.plusColor}" stroke-width="4" stroke-dasharray="7 6"/><path d="M0 -50V-18M-16 -34H16" stroke="${T.plusColor}" stroke-width="6" stroke-linecap="round"/></g></g>`}
/** L = officeLayout(...); L.agents = [{id,char,name,title}] (without the boss); opts.boss = {name,title}; opts.guestTitle */
function sceneSvg(L,T,opts={}){const sp=L.spots;
  let items=[];
  T.deco(L).forEach(d=>items.push({y:d[0],svg:d[1]}));
  const b=opts.boss||{name:'Harvey Specter',title:'Šéf'};
  items.push({y:0,svg:zone('boss','harvey',...sp.boss,T,b),boss:true});
  for(const a of L.agents){const [x,y,s]=sp[a.id];items.push({y,svg:zone(a.id,a.char,x,y,s,T,a)})}
  if(sp.__guest)items.push({y:sp.__guest[1],svg:opts.guestTitle?zone('guest','guest',...sp.__guest,T,{name:opts.guestTitle.slice(0,18),title:'Claude Code'}):''});
  items.push({y:sp.__plus[1],svg:plusZone(...sp.__plus,T)});
  items.sort((a,b)=>a.y-b.y);
  const bossIt=items.find(i=>i.boss);const rest=items.filter(i=>i!==bossIt);
  const behind=rest.filter(i=>i.y<=30), front=rest.filter(i=>i.y>30);
  const dust=`<g fill="#fff6c9" opacity=".5">${[[80,200],[330,260],[620,150],[860,330],[200,420]].map(([a,b],i)=>`<circle class="dust" style="animation-delay:-${i*2}s" cx="${a*L.W/960}" cy="${b*L.H/580}" r="2"/>`).join('')}</g>`;
  return `<svg viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg" role="img">${T.defs}${T.bg(L)}${behind.map(i=>i.svg).join('')}${T.room(L,bossIt.svg)}${front.map(i=>i.svg).join('')}${dust}${T.fg(L)}</svg>`}

/* ---------- the hallway: one door per repo ---------- */
const LIGHT={idle:'#8d96a6',working:'#3aa876',question:'#f0a020',done:'#4a8fdc',error:'#e5484d',partial:'#d08a2a'};
function doorSvg(x,y,d,T){ // x,y = bottom-centre of the door on the wall line
  const dw=92,dh=122,L=x-dw/2,Tp=y-dh;const col=LIGHT[d.light]||LIGHT.idle;
  const name=String(d.name||'');const fs=name.length>16?8:name.length>12?9.4:10.6;const nm=name.length>20?name.slice(0,19)+'…':name;
  return `<g class="door ${d.light}" data-repo="${esc(d.id)}" tabindex="0" role="button" aria-label="${esc(name)}">
  <rect x="${L-8}" y="${Tp-30}" width="${dw+16}" height="${dh+32}" rx="3" fill="#c9a24e"/><rect x="${L-5}" y="${Tp-27}" width="${dw+10}" height="${dh+29}" rx="2" fill="#10151f"/>
  <rect class="dglow" x="${L}" y="${Tp}" width="${dw}" height="${dh}" fill="#ffe3a0" opacity="0"/>
  <g class="leaf"><rect x="${L}" y="${Tp}" width="${dw}" height="${dh}" fill="url(#woodDoor)"/><rect x="${L+9}" y="${Tp+10}" width="${dw-18}" height="${dh*.38}" rx="2" fill="#000" opacity=".2"/><rect x="${L+9}" y="${Tp+dh*.5}" width="${dw-18}" height="${dh*.42}" rx="2" fill="#000" opacity=".2"/><rect x="${L+9}" y="${Tp+10}" width="${dw-18}" height="${dh*.38}" rx="2" fill="none" stroke="#fff" stroke-opacity=".1"/><circle cx="${L+dw-12}" cy="${Tp+dh*.52}" r="4.5" fill="#d6b45a"/><circle cx="${L+dw-13.2}" cy="${Tp+dh*.52-1.2}" r="1.4" fill="#fff" opacity=".7"/></g>
  <rect x="${L+8}" y="${Tp-22}" width="${dw-16}" height="14" rx="2" fill="${col}" opacity=".85"/><rect x="${L+8}" y="${Tp-22}" width="${dw-16}" height="14" rx="2" fill="#fff" opacity=".16"/>
  <rect x="${L-4}" y="${Tp-52}" width="${dw+8}" height="18" rx="2" fill="#c9a24e"/><rect x="${L-2}" y="${Tp-50}" width="${dw+4}" height="14" rx="1" fill="none" stroke="#7a5f1f" stroke-width=".6"/><text x="${x}" y="${Tp-39}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="#241708" font-family="Georgia,'Times New Roman',serif">${esc(nm)}</text>
  <circle class="slight" cx="${L+dw+16}" cy="${Tp+16}" r="6.5" fill="${col}" stroke="#0d1220" stroke-width="1.5"/><circle cx="${L+dw+16}" cy="${Tp+16}" r="12" fill="${col}" opacity=".25"/>
  ${d.badge?`<g class="dbadge"><circle cx="${L+dw+2}" cy="${Tp-28}" r="11" fill="#e5484d" stroke="#fff" stroke-width="2"/><text x="${L+dw+2}" y="${Tp-23.6}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="ui-rounded,system-ui,sans-serif">${d.badge}</text></g>`:''}
  <ellipse cx="${x}" cy="${y+6}" rx="${dw*.6}" ry="7" fill="#000" opacity=".25" filter="url(#soft)"/>
  ${d.caption?`<text x="${x}" y="${y+24}" text-anchor="middle" font-size="9.5" fill="#fff" opacity=".7" font-family="-apple-system,system-ui,sans-serif">${esc(String(d.caption).slice(0,26))}</text>`:''}</g>`}
function addDoorSvg(x,y,T){const dw=92,dh=122,L=x-dw/2,Tp=y-dh;return `<g class="door add" data-add="1" tabindex="0" role="button" aria-label="Přidat repozitář">
  <rect x="${L-8}" y="${Tp-30}" width="${dw+16}" height="${dh+32}" rx="3" fill="#c9a24e"/><rect x="${L-5}" y="${Tp-27}" width="${dw+10}" height="${dh+29}" rx="2" fill="#10151f"/>
  <g class="leaf"><rect x="${L}" y="${Tp}" width="${dw}" height="${dh}" fill="#cfe0ee" opacity=".3"/><rect x="${L}" y="${Tp}" width="${dw}" height="${dh}" fill="none" stroke="#9fb4c6" stroke-width="2"/><path d="M${L+10} ${Tp+8} L${L+40} ${Tp+dh*.55} M${L+30} ${Tp+6} L${L+70} ${Tp+dh*.6}" stroke="#fff" stroke-opacity=".3" stroke-width="7"/></g>
  <circle class="plusbtn" cx="${x}" cy="${Tp+dh*.46}" r="24" fill="#fff8e8" fill-opacity=".92" stroke="#c9a24e" stroke-width="3.5" stroke-dasharray="6 5"/><path d="M${x} ${Tp+dh*.46-14}V${Tp+dh*.46+14}M${x-14} ${Tp+dh*.46}H${x+14}" stroke="#c9a24e" stroke-width="5" stroke-linecap="round"/>
  <rect x="${L-4}" y="${Tp-52}" width="${dw+8}" height="18" rx="2" fill="#c9a24e"/><text x="${x}" y="${Tp-39.5}" text-anchor="middle" font-size="9" font-weight="800" fill="#241708" font-family="-apple-system,system-ui,sans-serif" letter-spacing="1">PŘIDAT REPO</text>
  <ellipse cx="${x}" cy="${y+6}" rx="${dw*.6}" ry="7" fill="#000" opacity=".25" filter="url(#soft)"/></g>`}
function hallSvg(isTall,T,doors){
  const W=isTall?400:960,cols=isTall?2:5,rowH=isTall?300:292,items=[...doors,{add:true}];const rows=Math.ceil(items.length/cols),H=rows*rowH+20,wallH=204;
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">${T.defs}<rect width="${W}" height="${H}" fill="url(#marble)"/><rect width="${W}" height="${H}" fill="url(#floorShine)"/>`;
  for(let r=0;r<rows;r++){const y0=r*rowH+10;let pan='';for(let x=0;x<W;x+=46)pan+=`<rect x="${x}" y="${y0}" width="2" height="${wallH-14}" fill="#2c3a58" opacity=".6"/>`;
    svg+=`<rect y="${y0}" width="${W}" height="${wallH}" fill="url(#wallS)"/>${pan}<rect y="${y0+wallH-14}" width="${W}" height="14" fill="#0d121e"/><rect y="${y0+wallH-14}" width="${W}" height="2.5" fill="#c9a24e"/><rect y="${y0}" width="${W}" height="2" fill="#c9a24e" opacity=".5"/><rect y="${y0+wallH}" width="${W}" height="14" fill="#000" opacity=".26" filter="url(#soft)"/>
    <rect x="${W*.06}" y="${y0+wallH+34}" width="${W*.88}" height="46" rx="6" fill="#4a1f2a" opacity=".78"/><rect x="${W*.06}" y="${y0+wallH+34}" width="${W*.88}" height="46" rx="6" fill="none" stroke="#c9a24e" stroke-width="1.6" opacity=".8"/>`}
  items.forEach((d,i)=>{const r=Math.floor(i/cols),c=i%cols,inRow=Math.min(cols,items.length-r*cols),off=(cols-inRow)*W/cols/2;const x=off+(c+.5)*W/cols,y=r*rowH+10+wallH-14;
    svg+=d.add?addDoorSvg(x,y,T):doorSvg(x,y,d,T);
    if(c<inRow-1)svg+=sconce(x+W/cols/2,y-86)});
  svg+=plantS(isTall?20:24,H-14,.8)+plantS(W-(isTall?20:24),H-14,.8);
  svg+=`<rect width="${W}" height="${H}" fill="url(#vig)" pointer-events="none"/>${T.night?`<rect width="${W}" height="${H}" fill="#0b1d3a" opacity=".28" style="mix-blend-mode:multiply" pointer-events="none"/>`:''}</svg>`;
  return svg}
