'use strict';

// Set 18 opener guide, https://bunnymuffins.lol/openers/
const aphelios = 'set-18-aphelios-flex';
const invoker = 'set-18-ahri-morgana';
const azir = 'set-18-azir-reroll';
const flora = 'set-18-soraka-flex';
const primal = 'set-18-invoker-nidalee-copy';
const veigar = 'set-18-dark-mages';

module.exports = {
  set: 18,
  patch: '18.3b',
  source: 'https://bunnymuffins.lol/openers/',
  hardForce: [
    {comp: aphelios, unit: 'DA_18_Aphelios', text: 'With Aphelios and an item ready for him, consider committing to Aphelios Flex.'},
    {comp: invoker, emblem: 'DA_18_EmblemInvoker', text: 'With an Invoker Emblem, consider committing to Invoker Ahri Morgana.'},
    {comp: azir, unit: 'DA_18_Azir', text: 'With Azir and an item ready for him, consider committing to Azir Reroll.'}
  ],
  emblems: [
    {emblem: 'DA_18_EmblemInvoker', comp: invoker, text: 'Invoker Emblem → Invoker Ahri Morgana'},
    {emblem: 'DA_18_EmblemExecutioner', comp: flora, text: 'Executioner Emblem → Flora Malphite'},
    {emblem: 'DA_18_EmblemExecutioner', comp: 'set-18-elderwood-executioners-copy', text: 'Executioner Emblem → Draven Fast 9'},
    {emblem: 'DA_18_EmblemJuggernaut', comp: 'set-18-6-juggernaut-ap', text: 'Juggernaut Emblem → Juggernaut Flex'},
    {emblem: 'DA_18_EmblemDefender', comp: 'set-18-defender-cassio', compUnits: ['DA_18_Cassiopeia', 'DA_18_Rengar'], text: 'Defender Emblem → Defender Cassiopeia Rengar'},
    {emblem: 'DA_18_EmblemRapidfire', comp: 'set-18-aphelios-rapidfire', text: 'Rapidfire Emblem → 5 Rapidfire Aphelios'},
    {emblem: 'DA_18_EmblemHunter', comp: primal, text: 'Hunter Emblem → Primal Malphite'},
    {emblem: 'DA_18_EmblemBrawler', comp: 'set-18-adaptor-reroll', text: 'Brawler Emblem → Adaptor Master Yi Reroll'}
  ],
  rerolls: [
    {comp: veigar, unit: 'DA_18_Veigar', stars: 2, slam: true, text: 'Veigar 2 with a slam → Veigar Reroll'},
    {comp: 'set-18-caitlyn-hunters', unit: 'DA_18_Caitlyn', item: 'DA_GuinsoosRageblade', text: 'Caitlyn + Guinsoo’s Rageblade → Caitlyn Reroll'},
    {comp: azir, unit: 'DA_18_Azir', component: 'DA_Component_NeedlesslyLargeRod', text: 'If your Azir came from an early orb, use your Rod to open Azir Reroll.'},
    {comp: 'set-18-riftbeast-reroll', unit: 'DA_Scuttlecrab18', secondTrait: 'DA_Riftbeast18', text: 'Scuttle Crab plus another Riftbeast → Riftbeast Reroll'},
    {comp: 'set-18-lunarwood-khazix', unit: 'DA_18_KhaZix', text: 'If your Kha’Zix came from an early orb, consider Kha’Zix Reroll.'},
    {comp: veigar, artifact: true, text: 'AP artifact → Veigar Reroll'}
  ],
  augmentRoutes: [
    {augment: 'DA_PrismaticTicket', comp: 'set-18-solar-kayle', text: 'Prismatic Ticket → consider Solar Kayle Reroll.'},
    {augment: 'DA_EarlyLearnings', comp: veigar, text: 'Early Learnings → consider Veigar Reroll.'},
    {augment: 'DA_SeraphimsStaff', comp: 'set-18-6-juggernaut-ap', text: 'Seraphim’s Staff → consider Zyra Juggernaut.'},
    {augment: 'DA_SoloPlate', comp: flora, text: 'Solo Plate → consider Flora Malphite.'}
  ],
  apArtifacts: [
    'DA_Artifact_Dawncore', 'DA_Artifact_Manazane', 'DA_Artifact_BlightingJewel',
    'DA_Artifact_LichBane', 'DA_Artifact_LudensTempest', 'DA_Artifact_SeekersArmguard', 'DA_Artifact_ZhonyasParadox'
  ],
  econAugments: [
    'DA_CapitalGainsI', 'DA_CapitalGainsII', 'DA_MoneyHungry_NotBroken', 'DA_CognitiveTax',
    'DA_TradeSector', 'DA_Epoch', 'DA_PatienceIsAVirtue', 'DA_LevelUp', 'DA_SilverSpoon'
  ],
  stageFour: [
    {comp: primal, text: 'If you’re loss streaking with a 2-1 econ augment, plan to stabilize on stage 4 with Primal Malphite.'},
    {comp: flora, text: 'If you’re loss streaking with a 2-1 econ augment, plan to stabilize on stage 4 with Flora Malphite.'},
    {comp: aphelios, text: 'If you’re loss streaking with a 2-1 econ augment, plan to stabilize on stage 4 with Aphelios Flex.'}
  ],
  directional: 'After 2-1 econ, look for a strong directional augment on 3-2, such as an emblem or artifact payoff.',
  slams: [
    {item: 'DA_SpearOfShojin', text: 'Spear of Shojin is the best flex slam for AD and AP holders.'},
    {item: 'DA_GargoyleStoneplate', text: 'Gargoyle Stoneplate is a top tank slam.'},
    {item: 'DA_WarmogsArmor', text: 'Warmog’s Armor is a top tank slam.'}
  ],
  components: ['DA_Component_BFSword', 'DA_Component_NeedlesslyLargeRod', 'DA_Component_GiantsBelt'],
  tempo: 'Slam useful items early to win fights and save HP.',
  itemAugment: 'Favor a 2-1 item augment when your opener can play for tempo.',
  // The guide's written priorities, grouped by cost. These are 18.3b holds.
  holds: {
    1: {
      priority: ['DA_18_Akali_AD', 'DA_18_Camille', 'DA_Cinderling18', 'DA_Karma18'],
      flexible: ['DA_18_Rakan', 'DA_18_Yorick', 'DA_18_RekSai', 'DA_18_Kobuko'],
      situational: ['DA_18_Ornn', 'DA_18_Leona', 'DA_18_Xayah', 'DA_18_Varus']
    },
    2: {
      priority: ['DA_18_LeBlanc', 'DA_18_Teemo', 'DA_Scuttlecrab18', 'DA_18_Caitlyn'],
      flexible: ['DA_18_Elise', 'DA_18_Sejuani', 'DA_18_Alistar', 'DA_Murkwolf18', 'DA_18_Warwick', 'DA_18_Yunara'],
      situational: ['DA_18_Shen']
    },
    3: {
      priority: ['DA_18_KhaZix', 'DA_18_Cassiopeia', 'DA_Krug18', 'DA_18_Diana'],
      flexible: ['DA_18_Azir', 'DA_18_Rengar'],
      situational: ['DA_18_MasterYi_AD', 'DA_KogMaw18_AD', 'DA_18_Tristana', 'DA_CrimsonRaptor18']
    }
  }
};
