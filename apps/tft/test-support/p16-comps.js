'use strict';

// Patch 18.7 guide IDs and the board targets used in the P1.6 browser checks.
const units = rows => rows.map(([apiName, ...items])=>({apiName, items, stars:1}));
const comp = (id, title, tier, main, rows, extra = {}) => ({
  id, title, tier, set:18, mainChampion:{apiName:main}, finalComp:units(rows), ...extra
});

const darkRitual = 'DA_18_CovenTraitAugment_LootToAP';
const currentUnits = units([
  ['DA_18_Alune'], ['DA_18_Ivern'], ['DA_18_Morgana'],
  ['DA_18_Rakan'], ['DA_18_Diana'], ['DA_18_Lillia']
]);
const apFast9 = comp('pe2ljiorlrcs6uj','AP Fast 9','S','DA_18_Alune',[
  ['DA_18_Rakan'], ['DA_18_Diana'], ['DA_18_Lillia'], ['DA_Fiddlesticks18'], ['DA_Taric18'],
  ['DA_Sentinel18','DA_WarmogsArmor','DA_Crownguard','DA_ProtectorsVow'],
  ['DA_18_Morgana','DA_VoidStaff','DA_Morellonomicon'], ['DA_18_Ivern','DA_SpearOfShojin','DA_AdaptiveHelm'],
  ['DA_18_Alune','DA_BlueBuff','DA_ArchangelsStaff','DA_JeweledGauntlet']
],{compSlug:'set-18-ap-95',style:'Fast 9'});
const mamawood = comp('s2co8lsczo7eyg1','Mamawood','S','DA_18_Zyra',[
  ['DA_18_Aphelios'], ['DA_18_Alistar'], ['DA_18_Hecarim','DA_WarmogsArmor'],
  ['DA_18_Zyra','DA_SpearOfShojin'], ['DA_18_Xayah']
],{compSlug:'set-18-mamawood'});
const covenElise = comp('o78b1h1g734c6ya','Coven Elise','X','DA_18_Elise',[
  ['DA_18_Elise','DA_TitansResolve','DA_GuinsoosRageblade','DA_GargoyleStoneplate'], ['DA_18_Diana'], ['DA_18_Hecarim'],
  ['DA_18_Cassiopeia','DA_SpearOfShojin','DA_HextechGunblade','DA_ArchangelsStaff'], ['DA_Sentinel18'],
  ['DA_18_Morgana','DA_VoidStaff','DA_Morellonomicon','DA_JeweledGauntlet'], ['DA_18_Alune']
],{compSlug:'set-18-coven-elise',mainAugment:{apiName:darkRitual}});
const solarEclipse = comp('2qyttne74cmvtn0','Solar Eclipse','X','DA_18_Aphelios',[
  ['DA_18_Diana'], ['DA_18_Aphelios','DA_GuinsoosRageblade','DA_LastWhisper'], ['DA_18_Alune','DA_BlueBuff']
],{compSlug:'set-18-solar-eclipse',mainItem:{apiName:'DA_18_EmblemLunar'}});

module.exports = {apFast9, mamawood, covenElise, solarEclipse, currentUnits, darkRitual};
