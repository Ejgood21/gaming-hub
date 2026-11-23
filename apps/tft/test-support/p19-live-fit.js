'use strict';

// Fit inputs from the TFT Academy Set 18 API on November 23, 2026 (Patch 18.7).
// The fixture retains the relevant end boards, item priorities and augment listings.
const guides = [
  {
    id: "pe2ljiorlrcs6uj",
    title: "AP Fast 9",
    compSlug: "set-18-ap-95",
    tier: "S",
    style: "Fast 9",
    mainChampion: {apiName: "DA_18_Alune"},
    earlyComp: [
      {apiName: "DA_Karma18", items: ["DA_BlueBuff", "DA_JeweledGauntlet"], boardIndex: null, stars: 1},
      {apiName: "DA_18_Rakan", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Yorick", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Yunara", items: [], boardIndex: null, stars: 1}
    ],
    finalComp: [
      {apiName: "DA_18_Rakan", items: [], boardIndex: 9, stars: 1},
      {apiName: "DA_18_Diana", items: [], boardIndex: 10, stars: 1},
      {apiName: "DA_Fiddlesticks18", items: [], boardIndex: 0, stars: 1},
      {apiName: "DA_18_Lillia", items: [], boardIndex: 6, stars: 1},
      {apiName: "DA_18_Morgana", items: ["DA_VoidStaff", "DA_Morellonomicon"], boardIndex: 11, stars: 1},
      {apiName: "DA_Sentinel18", items: ["DA_WarmogsArmor", "DA_Crownguard", "DA_ProtectorsVow"], boardIndex: 3, stars: 1},
      {apiName: "DA_Taric18", items: [], boardIndex: 4, stars: 1},
      {apiName: "DA_18_Ivern", items: ["DA_SpearOfShojin", "DA_AdaptiveHelm"], boardIndex: 21, stars: 1},
      {apiName: "DA_18_Alune", items: ["DA_BlueBuff", "DA_ArchangelsStaff", "DA_JeweledGauntlet"], boardIndex: 27, stars: 1}
    ],
    carousel: [{apiName: "DA_SpearOfShojin"},{apiName: "DA_Component_NeedlesslyLargeRod"},{apiName: "DA_Component_TearOfTheGoddess"},{apiName: "DA_Component_GiantsBelt"}],
    augments: []
  },
  {
    id: "s2co8lsczo7eyg1",
    title: "Mamawood",
    compSlug: "set-18-mamawood",
    tier: "S",
    style: "3-Cost Reroll",
    mainChampion: {apiName: "DA_CrimsonRaptor18"},
    earlyComp: [
      {apiName: "DA_18_Ornn", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Varus", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Xayah", items: ["DA_GuinsoosRageblade", "DA_HextechGunblade"], boardIndex: null, stars: 1},
      {apiName: "DA_18_Shen", items: [], boardIndex: null, stars: 1}
    ],
    finalComp: [
      {apiName: "DA_Elderwood18_StonebarkTree", items: [], boardIndex: 6, stars: 1},
      {apiName: "DA_18_Aphelios", items: [], boardIndex: 22, stars: 2},
      {apiName: "DA_18_Alistar", items: [], boardIndex: 5, stars: 1},
      {apiName: "DA_Krug18", items: ["DA_SunfireCape", "DA_Evenshroud"], boardIndex: 3, stars: 3},
      {apiName: "DA_18_Hecarim", items: ["DA_WarmogsArmor", "DA_GargoyleStoneplate", "DA_ProtectorsVow"], boardIndex: 2, stars: 3},
      {apiName: "DA_CrimsonRaptor18", items: ["DA_GuinsoosRageblade", "DA_HextechGunblade", "DA_TitansResolve"], boardIndex: 21, stars: 3},
      {apiName: "DA_Sentinel18", items: [], boardIndex: 4, stars: 1},
      {apiName: "DA_18_Zyra", items: [], boardIndex: 23, stars: 1},
      {apiName: "DA_18_Xayah", items: [], boardIndex: 27, stars: 1},
      {apiName: "DA_Elderwood18_Lifeblossom", items: [], boardIndex: 25, stars: 1}
    ],
    carousel: [{apiName: "DA_GuinsoosRageblade"},{apiName: "DA_HextechGunblade"},{apiName: "DA_GargoyleStoneplate"},{apiName: "DA_Component_ChainVest"}],
    augments: []
  },
  {
    id: "nka7oiom5y8dpqi",
    title: "Adaptor Reroll",
    compSlug: "set-18-adaptor-reroll",
    tier: "A",
    style: "3-Cost Reroll",
    mainChampion: {apiName: "DA_18_MasterYi_AD"},
    earlyComp: [
      {apiName: "DA_Karma18", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Yorick", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_Gromp18_AP", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_MasterYi_AD", items: [], boardIndex: null, stars: 1}
    ],
    finalComp: [
      {apiName: "DA_18_Yorick", items: [], boardIndex: 27, stars: 1},
      {apiName: "DA_Krug18", items: [], boardIndex: 13, stars: 1},
      {apiName: "DA_KogMaw18_AD", items: ["DA_SpearOfShojin", "DA_RedBuff", "DA_GiantSlayer"], boardIndex: 21, stars: 3},
      {apiName: "DA_18_MasterYi_AD", items: ["DA_GuinsoosRageblade", "DA_EdgeOfNight", "DA_TitansResolve"], boardIndex: 7, stars: 3},
      {apiName: "DA_Vi18", items: ["DA_WarmogsArmor", "DA_GargoyleStoneplate", "DA_GargoyleStoneplate"], boardIndex: 1, stars: 3},
      {apiName: "DA_18_Sett", items: [], boardIndex: 6, stars: 1},
      {apiName: "DA_Nidalee18_AP", items: ["DA_GuinsoosRageblade", "DA_RabadonsDeathcap"], boardIndex: 22, stars: 1}
    ],
    carousel: [{apiName: "DA_GuinsoosRageblade"},{apiName: "DA_EdgeOfNight"},{apiName: "DA_Component_ChainVest"},{apiName: "DA_Component_RecurveBow"}],
    augments: []
  },
  {
    id: "xyl2tqxirk27vaa",
    title: "Defender Cassio",
    compSlug: "set-18-defender-cassio",
    tier: "B",
    style: "3-Cost Reroll",
    mainChampion: {apiName: "DA_18_Cassiopeia"},
    earlyComp: [
      {apiName: "DA_Karma18", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Leona", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Ornn", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_LeBlanc", items: [], boardIndex: null, stars: 1}
    ],
    finalComp: [
      {apiName: "DA_18_Leona", items: [], boardIndex: 2, stars: 1},
      {apiName: "DA_18_Ornn", items: [], boardIndex: 1, stars: 3},
      {apiName: "DA_18_Shen", items: [], boardIndex: 3, stars: 1},
      {apiName: "DA_18_Cassiopeia", items: ["DA_SpearOfShojin", "DA_HextechGunblade", "DA_ArchangelsStaff"], boardIndex: 27, stars: 3},
      {apiName: "DA_Fiddlesticks18", items: ["DA_TitansResolve", "DA_AdaptiveHelm", "DA_Crownguard"], boardIndex: 4, stars: 3},
      {apiName: "DA_18_Rammus", items: ["DA_IonicSpark", "DA_SunfireCape", "DA_SteadfastHeart"], boardIndex: 5, stars: 3},
      {apiName: "DA_18_Lillia", items: ["DA_ThiefsGloves"], boardIndex: 0, stars: 1}
    ],
    carousel: [{apiName: "DA_SpearOfShojin"},{apiName: "DA_HextechGunblade"},{apiName: "DA_Component_ChainVest"},{apiName: "DA_Component_NeedlesslyLargeRod"}],
    augments: [{apiName: "DA_WovenMagic"}]
  },
  {
    id: "h1xsw0nq91zf4fe",
    title: "Draven Dragon 9",
    compSlug: "set-18-dragon-princess",
    tier: "A",
    style: "Fast 9",
    mainChampion: {apiName: "DA_Draven18"},
    earlyComp: [
      {apiName: "DA_Cinderling18", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Sentry", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_18_Yorick", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_Scuttlecrab18", items: [], boardIndex: null, stars: 1}
    ],
    finalComp: [
      {apiName: "DA_Amumu18", items: [], boardIndex: 4, stars: 1},
      {apiName: "DA_Sentinel18", items: ["DA_ProtectorsVow"], boardIndex: 3, stars: 1},
      {apiName: "DA_Taric18", items: [], boardIndex: 1, stars: 1},
      {apiName: "DA_18_Kennen", items: ["DA_ThiefsGloves"], boardIndex: 2, stars: 1},
      {apiName: "DA_Draven18", items: ["DA_GuinsoosRageblade", "DA_LastWhisper", "DA_KrakensFury"], boardIndex: 27, stars: 1},
      {apiName: "DA_18_ElderDragon", items: ["DA_InfinityEdge", "DA_Deathblade", "DA_StrikersFlail"], boardIndex: 20, stars: 1},
      {apiName: "DA_18_Ivern", items: ["DA_GuinsoosRageblade", "DA_SpearOfShojin", "DA_AdaptiveHelm"], boardIndex: 21, stars: 1},
      {apiName: "DA_18_Maokai", items: ["DA_WarmogsArmor", "DA_Crownguard", "DA_Evenshroud"], boardIndex: 5, stars: 1}
    ],
    carousel: [{apiName: "DA_InfinityEdge"},{apiName: "DA_Component_BFSword"},{apiName: "DA_Component_SparringGloves"},{apiName: "DA_Component_GiantsBelt"}],
    augments: [{apiName: "DA_LevelUp"}]
  },
  {
    id: "0r6d7771fy8zjze",
    title: "10 Riftbeast",
    compSlug: "set-18-10-riftbeast",
    tier: "A",
    style: "Fast 9",
    mainChampion: {apiName: "DA_Brambleback18"},
    earlyComp: [
      {apiName: "DA_18_Sentry", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_Scuttlecrab18", items: [], boardIndex: null, stars: 1},
      {apiName: "DA_Murkwolf18", items: ["DA_GuinsoosRageblade", "DA_EdgeOfNight", "DA_Quicksilver"], boardIndex: null, stars: 1},
      {apiName: "DA_18_Rakan", items: [], boardIndex: null, stars: 1}
    ],
    finalComp: [
      {apiName: "DA_Gromp18_AP", items: [], boardIndex: 23, stars: 1},
      {apiName: "DA_18_Sentry", items: [], boardIndex: 21, stars: 1},
      {apiName: "DA_CrimsonRaptor18", items: [], boardIndex: 27, stars: 1},
      {apiName: "DA_Brambleback18", items: ["DA_EdgeOfNight", "DA_Quicksilver", "DA_GuinsoosRageblade"], boardIndex: 1, stars: 1},
      {apiName: "DA_Scuttlecrab18", items: [], boardIndex: 0, stars: 1},
      {apiName: "DA_Murkwolf18", items: [], boardIndex: 25, stars: 1},
      {apiName: "DA_Taric18", items: [], boardIndex: 2, stars: 1},
      {apiName: "DA_Sentinel18", items: ["DA_ProtectorsVow"], boardIndex: 3, stars: 1},
      {apiName: "DA_Krug18", items: ["DA_WarmogsArmor", "DA_BrambleVest", "DA_DragonsClaw"], boardIndex: 4, stars: 1},
      {apiName: "DA_18_ElderDragon", items: ["DA_InfinityEdge", "DA_StrikersFlail", "DA_Deathblade"], boardIndex: 7, stars: 1},
      {apiName: "DA_18_GnarSmall", items: ["DA_ThiefsGloves"], boardIndex: 8, stars: 1}
    ],
    carousel: [{apiName: "DA_GuinsoosRageblade"},{apiName: "DA_Component_BFSword"},{apiName: "DA_Component_ChainVest"},{apiName: "DA_Component_SparringGloves"}],
    augments: []
  }
];
const items = [
  {apiName: "DA_WarmogsArmor", name: "Warmog's Armor", type: "craftables", composition: ["DA_Component_GiantsBelt", "DA_Component_GiantsBelt"]}
];
const augments = [
  {apiName: "DA_LevelUp", name: "Level Up!", description: "When you buy XP, gain an additional 2. Gain 6 immediately.", stages: ["2-1"], tier: 3},
  {apiName: "DA_PatientStudy", name: "Patient Study", description: "After player combat, gain 2 XP if you won or 3 XP if you lost.", stages: ["2-1"], tier: 2},
  {apiName: "DA_TradeSector", name: "Trade Sector", description: "Gain a free Shop reroll every round. Gain 2 gold.", stages: ["2-1"], tier: 2},
  {apiName: "DA_WovenMagic", name: "Woven Magic", description: "Gain a random item component. Every 2200 Mana spent by your champions, grants an additional component (max: 0/3).", stages: ["2-1"], tier: 2},
  {apiName: "DA_18_RivalsAugment", name: "Unrivaled", description: "You can field Rengar and Kha'Zix together with no penalties, and they gain bonuses when the other casts. Gain a Rengar and a Kha'Zix.", stages: ["2-1", "3-2"], tier: 2},
  {apiName: "DA_18_RivalsAugmentPlus", name: "Unrivaled", description: "You can field Rengar and Kha'Zix together with no penalties, and they gain bonuses when the other casts. Gain a Rengar and a Kha'Zix.", stages: [], tier: 2}
];

module.exports = {guides, items, augments};
