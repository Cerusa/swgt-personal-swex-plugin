const request = require('request');
const fs = require('fs');
const path = require('path');

const version = '2.3.0';
const pluginName = 'SWGTPersonalLogger';
const siteURL = 'https://swgt.io';
var wizardBattles = [];
const siegeGuildRanking = new Map();
const worldGuildBattleGuildRanking = new Map();
var sendBattles = [];
var tempDefenseDeckInfo = [];
var observerDefenseInfo = [];
var observerAttackerList = [];
var localAPIkey = '';
var apiReference = {
     messageType: 'OK',
     enabledWizards: [],
     isSWGTPersonalSubscriber: false,
     isSWGTPersonalPlusSubscriber: false
};

var swgtPersonalListenToSWGTCommands = [
     //Character JSON and Guild Member List
     'HubUserLogin',

     //Guild Info
     'GetGuildInfo',
     `GetGuildDataAll`,

     //Siege
     'GetGuildSiegeBattleLogByWizardId',
     'GetGuildSiegeBattleLog',
     'GetGuildSiegeMatchupInfo',
     'GetGuildSiegeMatchupInfoForFinished',
     'GetGuildSiegeBaseDefenseUnitList',
     'GetGuildSiegeBaseDefenseUnitListPreset',
     'GetGuildSiegeRankingInfo',

     //Labyrinth
     'GetGuildMazeStatusInfo',
     'GetGuildMazeRankingList',
     'GetGuildMazeRanking',
     'GetGuildMazeContributeList',
     'GetGuildMazeBattleLogByWizard',
     'GetGuildMazeBattleLogByTile',

     //World Guild Battle (Server Guild War)
     'GetServerGuildWarBattleLogByGuild',
     //'GetServerGuildWarMatchLog', //<--Removed because Com2us broke it with special characters
     'GetServerGuildWarMatchInfo',
     'GetServerGuildWarRanking',
     'GetServerGuildWarBattleLogByWizard',
     'GetServerGuildWarDefenseDeckList',
     'GetServerGuildWarParticipationInfo',//rating_id
     //'GetServerGuildWarBaseDeckList',
     //'GetServerGuildWarBaseInfoListForOppView',
     //'GetServerGuildWarContributeList',

     //Monster Subjugation
     'getGuildBossBattleInfo',
     'getGuildBossBattleLogByWizard',
     'getGuildBossContributeList',
     'getGuildBossRankingList',

     'getUnitStorageList', //Sealed Unit Storage

     //Runes and Artifacts
     'BattleDungeonResult_V2',
     'BattleWorldBossResult_v2',

     //Rune Upgrades
     'UpgradeRune',
     'upgradeRune_v2',
     'AmplifyRune_v2',
     'ConvertRune_v2',
     'ConfirmRune',
     'SellRune',
     'RepurchaseRune',
     'UpgradeRuneList',

     //Rune markers
     'AddRuneLock',
     'updateMarker',
     'RemoveRuneLock',

     //Artifacts
     'ConfirmArtifactConversion',
     'ConvertArtifactByCraft',
     'SellArtifacts',
     'RepurchaseArtifact'
];

var swgtPersonalListenTo3MDCCommands = [
     //World Guild Battle (Server Guild War)
     'GetServerGuildWarMatchInfo',
     'GetServerGuildWarBaseDeckList',
     'BattleServerGuildWarStart',
     'BattleServerGuildWarRoundResult',
     'BattleServerGuildWarResult',
     'BattleServerGuildWarStartVirtual',
     'BattleServerGuildWarResultVirtual',
     //Siege
     'BattleGuildSiegeStart_v2',//offense and defense mons
     'BattleGuildSiegeResult',//win/loss
     'GetGuildSiegeMatchupInfo',//rating_id

     //SiegeTest
     'GetGuildSiegeRankingInfo',//rating_id
     'SetGuildSiegeBattleReplayData',//offense, defense and results

     //WorldGuildBattleTest
     'GetServerGuildWarParticipationInfo',//rating_id
     'SetServerGuildWarBattleReplayData'
];

var swgtPersonalListenToSWGTHistoryCommands = [
     //Siege Defense Units
     'GetGuildSiegeBaseDefenseUnitList',
     'GetGuildSiegeBaseDefenseUnitListPreset',
     'GetGuildSiegeDefenseDeckByWizardId',

     //Defense Log Link
     'GetGuildSiegeBattleLogByDeckId'
];

var swgtPersonalPlusCommands = [
     //Equip Runes/Artifacts all normal
     'UpdateUnitEquip',
     'UnequipRune',
     //Equip Runes/Artifacts RTA
     'updateRuneEquip','UpdateRuneEquip',
     'removeRuneEquip',
     'UpdateArtifactOccupationContents'
];

var swgtPersonalRealTimeEquipRemoveRuneAndArtifactCommands = [
     //Equip Runes/Artifacts all normal
     'UpdateUnitEquip',
     'UnequipRune',
     //Equip Runes/Artifacts RTA
     'updateRuneEquip','UpdateRuneEquip',
     'removeRuneEquip',
     'UpdateArtifactOccupationContents'
];

module.exports = {
     pluginName,
     version,
     autoUpdate: {
          versionURL: 'https://swgt.io/staticContent/SWGTPersonalLogger.yml'
     },
     defaultConfig: {
          enabled: true,
          sendCharacterJSON: true,
          uploadBattles: false,
          realTimeEqiupRemoveRuneArtifact: false,
          saveToFile: false,
          apiKey: ''
     },
     defaultConfigDetails: {
          sendCharacterJSON: { label: 'Send Character JSON?' },
          //importMonsters: { label: 'Import monsters?' },
          uploadBattles: { label: 'Enable Siege/WGB Battle Logs?' },
          realTimeEqiupRemoveRuneArtifact: { label: 'Real-time equip/remove runes/artifacts?' },
          saveToFile: { label: 'Save to file for debugging?' },
          apiKey: { label: 'SWGT Personal API key (On your SWGT profile page)', type: 'input' },
     },
     pluginDescription: 'For SWGT Personal Patreon subscribers to automatically ' +
          'upload various Summoners War data. Enable Character JSON to automatically update ' +
          'your guild\'s members and your player\'s units/runes/artifacts. ' +
          'Enable battle uploading to automatically log defenses and counters.',
     init(proxy, config) {
          cacheP = {};
          cachePDuration = {};
          cachePTimerSettings = [
               { command: 'getguildinfo', timer: 60000 },
               { command: 'getguildwarranking', timer: 300000 },
               { command: 'getguildwarmatchlog', timer: 60000 },
               { command: 'getguildsiegematchupinfo', timer: 60000 },
               { command: 'getguildsiegerankinginfo', timer: 300000 },
               { command: 'getguildmazestatusinfo', timer: 300000 },
          ];

          proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: 
               "Listening to commands:<br>" + 
               swgtPersonalListenToSWGTCommands.toString().replace(/,/g, ', ') + 
               '<br><br>' + 
               swgtPersonalListenTo3MDCCommands.toString().replace(/,/g, ', ')  + 
               '<br><br>' + 
               swgtPersonalListenToSWGTHistoryCommands.toString().replace(/,/g, ', ')  + 
               '<br><br>' + 
               swgtPersonalPlusCommands.toString().replace(/,/g, ', ')
          });

          //Process commands
          proxy.on('apiCommand', (req, resp) => {
               let { command } = resp;
               if(command)
                    command = command.toLowerCase();

               let howToProcess = "";
               processCommand:{
                    if(command){
                         //Handle broken commands
                         if (command.startsWith('getserverguildwarmatc') && command.endsWith('log')) {
                              howToProcess = "SWGT";
                              break processCommand; //Stop Processing
                         }

                         //Handle SWGT commands
                         for (let commandIndex in swgtPersonalListenToSWGTCommands) {
                              let tempCommand = swgtPersonalListenToSWGTCommands[commandIndex];
                              if(tempCommand)
                                   tempCommand = tempCommand.toLowerCase();

                              if(tempCommand == command){
                                   howToProcess = "SWGT";
                                   break processCommand; //Stop Processing
                              }
                         }
                         //Handle SWGT Personal+ commands
                         for (let commandIndex in swgtPersonalPlusCommands) {
                              let tempCommand = swgtPersonalPlusCommands[commandIndex];
                              if(tempCommand)
                                   tempCommand = tempCommand.toLowerCase();

                              if(tempCommand == command){
                                   howToProcess = "SWGT";
                                   break processCommand; //Stop Processing
                              }
                         }
                         //Handle 3MDC events if enabled
                         if (config.Config.Plugins[pluginName].uploadBattles) {
                               for (let commandIndex in swgtPersonalListenTo3MDCCommands) {
                                   let tempCommand = swgtPersonalListenTo3MDCCommands[commandIndex];
                                   if(tempCommand)
                                        tempCommand = tempCommand.toLowerCase();
                                   if(tempCommand == command){
                                        howToProcess = "3MDC";
                                        break processCommand; //Stop Processing
                                   }
                               }
                         }
                         //Attach SWGT Siege Log History Data
                          if (config.Config.Plugins[pluginName].enabled) {
                              for (let commandIndex in swgtPersonalListenToSWGTHistoryCommands) {
                                   let tempCommand = swgtPersonalListenToSWGTHistoryCommands[commandIndex];
                                   if(tempCommand)
                                        tempCommand = tempCommand.toLowerCase();

                                   if(tempCommand == command){
                                        howToProcess = "SWGT_HISTORY";
                                        break processCommand; //Stop Processing
                                   }
                              }
                         }
                    }
               }

               switch(howToProcess) {
                    case "SWGT":
                         this.processRequest(
                              command, 
                              proxy, 
                              config, 
                              req, 
                              structuredClone(resp), //Deep copy
                              cacheP
                         );
                         break;
                    case "3MDC":
                         this.process3MDCRequest(
                              command, 
                              proxy, 
                              config, 
                              req, 
                              structuredClone(resp), //Deep copy
                              cacheP
                         );
                         break;
                    case "SWGT_HISTORY":
                         var pRespCopy = structuredClone(resp); //Deep copy
                         this.processSWGTHistoryRequest(
                              command, 
                              proxy, 
                              config, 
                              req, 
                              structuredClone(resp), //Deep copy
                              cacheP
                         );
                         break;
                    default:
                         //Do Nothing
               } 
          });
          

          //Confirm SWGT plugin version and Site API Settings
          this.checkVersion(proxy, config);
          this.checkSiteAPI(proxy, config);
     },
     hasAPIEnabled(config, proxy) {
          if (!config.Config.Plugins[pluginName].enabled) return false;

          if (!config.Config.Plugins[pluginName].apiKey) {
               proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: 'Missing API key.' });
               return false;
          }
          return true;
     },
     hasAPISettings(config, proxy) {
          if (localAPIkey != config.Config.Plugins[pluginName].apiKey) {
               this.checkSiteAPI(proxy, config);
               localAPIkey = config.Config.Plugins[pluginName].apiKey;

          }
          
          if (apiReference.messageType === 'OK') {
               //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'API Key Good' });
               return true;
          }
          if (apiReference.messageType === 'Warning') {
               proxy.log({ type: 'warning', source: 'plugin', name: this.pluginName, message: 'API Key near expiration' });
               return true;
          }
          if (apiReference.messageType === 'Error') {
               proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: 'API Key Incorrect or Expired.' });
               return false;
          }
          return false;
     },
     processRequest(command, proxy, config, req, resp, cacheP) {
          let lowerCaseCommand = command.toLowerCase();

          if (!config.Config.Plugins[pluginName].sendCharacterJSON){
               //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'sendCharacterJSON disabled' });
               return;
          }
          if (!this.verifyPacketToSend(proxy, config, req, resp)){
               //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'verifyPacketToSend failed' });
               return;
          }

          var checkCache = true;

          let isSWGTPersonalPlusCommand = false;
          for (let commandIndex in swgtPersonalPlusCommands) {
               let tempCommand = swgtPersonalPlusCommands[commandIndex];
               if(tempCommand)
                    tempCommand = tempCommand.toLowerCase();

               if(lowerCaseCommand == tempCommand){
                    isSWGTPersonalPlusCommand = true;
                    break;
               }
          }
          let isSwgtPersonalRealTimeEquipRemoveRuneAndArtifactCommand = false;
          for (let commandIndex in swgtPersonalRealTimeEquipRemoveRuneAndArtifactCommands) {
               let tempCommand = swgtPersonalRealTimeEquipRemoveRuneAndArtifactCommands[commandIndex];
               if(tempCommand)
                    tempCommand = tempCommand.toLowerCase();

               if(lowerCaseCommand == tempCommand){
                    isSwgtPersonalRealTimeEquipRemoveRuneAndArtifactCommand = true;
                    break;
               }
          }
          
          if(isSWGTPersonalPlusCommand){
               if(apiReference['isSWGTPersonalPlusSubscriber'] == false){
                    //Do Nothing - Not Authorized
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: 
                         "Skipping " +resp['command']+" because not authorized" 
                    });
                    return;
               }
               if(isSwgtPersonalRealTimeEquipRemoveRuneAndArtifactCommand){
                    if(config.Config.Plugins[pluginName].realTimeEqiupRemoveRuneArtifact){
                         checkCache = false;
                    }else{
                         proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: 
                              "Skipping " +resp['command']+" because real-time update not enabled" 
                         });
                         return;
                    }
               }
          }

          if(lowerCaseCommand == 'getUnitStorageList'.toLowerCase()){
               if('wizard_id' in req)
                    resp.wizard_id = req.wizard_id;
          }
          if(lowerCaseCommand == 'UpdateArtifactOccupationContents'.toLowerCase()){
               if('content_type' in req)
                    resp.content_type = req.content_type;
               if('wizard_id' in req)
                    resp.wizard_id = req.wizard_id;
          }
          if (lowerCaseCommand== 'GetServerGuildWarParticipationInfo'.toLowerCase()) {
               try {
                    worldGuildBattleGuildRanking.set(resp.ranking_info.guild_id, resp.ranking_info.rating_id);
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
               return;
          }

          //Clone for usage
          var pResp = structuredClone(resp); //pruned response object to ensure global object not modified for other plugins
          var pReq = structuredClone(req); //pruned request object to ensure global object not modified for other plugins

          //Clean ConvertArtifactByCraft resp
          if (lowerCaseCommand == 'ConvertArtifactByCraft'.toLowerCase()) {
               if ('wizard_info' in pResp) { delete pResp['wizard_info'] };
               if ('artifact_before' in pResp) { delete pResp['artifact_before'] };
               if ('artifact_after' in pResp) { delete pResp['artifact_after'] };
               if ('artifact_craft' in pResp) { delete pResp['artifact_craft'] };
          }

          //Clean BattleDungeonResult_V2 or BattleWorldBossResult_v2 resp
          if (lowerCaseCommand == 'BattleDungeonResult_V2'.toLowerCase() || lowerCaseCommand == 'BattleWorldBossResult_v2'.toLocaleLowerCase()) {

               if ('clear_time' in pResp) { delete pResp['clear_time'] };
               if ('unit_list' in pResp) { delete pResp['unit_list'] };
               if ('reward' in pResp) { delete pResp['reward'] };

               if ('changed_item_list' in pResp) {
                    var changed_item_list_size = pResp.changed_item_list.length;
                    for (var adIndex = 0; adIndex < changed_item_list_size; adIndex++) {
                         itemDrop = pResp.changed_item_list[adIndex];

                         if ('view' in itemDrop && 'rune_set_id' in itemDrop.view && (itemDrop.view.rune_set_id * 1) > 0 && 'info' in itemDrop) {
                              var runeDrop = {};
                              //Build custom packet to send to SWGT
                              runeDrop.command = "CustomDungeonRuneDrop";
                              runeDrop.wizard_id = itemDrop.info.wizard_id
                              runeDrop.rune = itemDrop.info;

                              if ('ts_val' in pResp)
                                   runeDrop.ts_val = pResp.ts_val;
                              if ('tvalue' in pResp)
                                   runeDrop.tvalue = pResp.tvalue;
                              if ('tvaluelocal' in pResp)
                                   runeDrop.tvaluelocal = pResp.tvaluelocal;
                              if ('tzone' in pResp)
                                   runeDrop.tzone = pResp.tzone;
                              if ('reqid' in pResp)
                                   runeDrop.reqid = pResp.reqid;
                              if ('server_id' in pResp)
                                   runeDrop.server_id = pResp.server_id;
                              if ('server_endpoint' in pResp)
                                   runeDrop.server_endpoint = pResp.server_endpoint;
                              if ('swex_version' in pResp)
                                   runeDrop.swex_version = pResp.swex_version;

                              //Send rune drop to server
                              this.writeToFile(proxy, req, runeDrop, `SWGT-${runeDrop.command}-`);
                              if (this.verifyPacketToSend(proxy, config, req, runeDrop)) {
                                   this.uploadToWebService(proxy, config, req, runeDrop, 'SWGT');
                              }
                              continue;
                         }
                         if ('view' in itemDrop && 'artifact_type' in itemDrop.view && (itemDrop.view.artifact_type * 1) > 0 && 'info' in itemDrop) {
                              var artifactDrop = {};
                              //Build custom packet to send to SWGT
                              artifactDrop.command = "CustomDungeonArtifactDrop";
                              artifactDrop.wizard_id = itemDrop.info.wizard_id
                              artifactDrop.artifact = itemDrop.info;

                              if ('ts_val' in pResp)
                                   artifactDrop.ts_val = pResp.ts_val;
                              if ('tvalue' in pResp)
                                   artifactDrop.tvalue = pResp.tvalue;
                              if ('tvaluelocal' in pResp)
                                   artifactDrop.tvaluelocal = pResp.tvaluelocal;
                              if ('tzone' in pResp)
                                   artifactDrop.tzone = pResp.tzone;
                              if ('reqid' in pResp)
                                   artifactDrop.reqid = pResp.reqid;
                              if ('server_id' in pResp)
                                   artifactDrop.server_id = pResp.server_id;
                              if ('server_endpoint' in pResp)
                                   artifactDrop.server_endpoint = pResp.server_endpoint;
                              if ('swex_version' in pResp)
                                   artifactDrop.swex_version = pResp.swex_version;

                              //Send artifact drop to server
                              this.writeToFile(proxy, req, artifactDrop, `SWGT-${artifactDrop.command}-`);
                              if (this.verifyPacketToSend(proxy, config, req, artifactDrop)) {
                                   this.uploadToWebService(proxy, config, req, artifactDrop, 'SWGT');
                              }
                              continue;
                         }
                    }
               }
               return;
          }

          var items = 1;
          if (lowerCaseCommand == 'HubUserLogin'.toLowerCase()) {
               if ('wizard_info' in pResp && 'wizard_id' in pResp.wizard_info)
                    req.wizard_id = pResp.wizard_info.wizard_id;

               if (!this.verifyPacketToSend(proxy, config, req, resp)) return;
          }
          if (lowerCaseCommand == 'GetServerGuildWarBattleLogByGuild'.toLowerCase()) {
               items = 0;
               pruned = pResp;
               for (var i in pruned.match_log_list) {
                    for (var k = pruned.match_log_list[i].battle_log_list.length - 1; k >= 0; k--) {
                         if (!apiReference['enabledWizards'].includes(pruned.match_log_list[i].battle_log_list[k].wizard_id)) {
                              pruned.match_log_list[i].battle_log_list.splice(k, 1);
                         }
                    }
                    items += pruned.match_log_list[i].battle_log_list.length;
               }
               pResp = pruned;
          }
          if (lowerCaseCommand == 'GetServerGuildWarBattleLogByWizard'.toLowerCase()) {
               items = 0;
               pruned = pResp;
               for (var k = pruned.battle_log_list.length - 1; k >= 0; k--) {
                    for (var j = pruned.battle_log_list[k].length - 1; j >= 0; j--) {
                         if (!apiReference['enabledWizards'].includes(pruned.battle_log_list[k][j].wizard_id)) {
                              pruned.battle_log_list[k].splice(j, 1);
                         }
                    }
               }
               items += pruned.battle_log_list.length;

               pResp = pruned;
          }

          if (lowerCaseCommand == 'GetGuildSiegeBattleLog'.toLowerCase() || lowerCaseCommand == 'GetGuildSiegeBattleLogByWizardId'.toLowerCase()) {
               items = 0;
               pruned = pResp;//'log_list' array of sieges into 'battle_log_list' array of battles with 'wizard_id' on each battle--if array is empty don't send packet
               for (var i in pruned.log_list) {
                    for (var k = pruned.log_list[i].battle_log_list.length - 1; k >= 0; k--) {
                         if (!apiReference['enabledWizards'].includes(pruned.log_list[i].battle_log_list[k].wizard_id)) {
                              pruned.log_list[i].battle_log_list.splice(k, 1);
                         }
                    }
                    items += pruned.log_list[i].battle_log_list.length;
               }
               pResp = pruned;
          }

          if (lowerCaseCommand == 'GetGuildSiegeBaseDefenseUnitList'.toLowerCase() || lowerCaseCommand == 'GetGuildSiegeBaseDefenseUnitListPreset'.toLowerCase()) {
               items = 0;
               pruned = pResp;
               //items += pruned.defense_deck_list.length - 1;
               for (var k = pruned.defense_deck_list.length - 1; k >= 0; k--) {
                    if (!apiReference['enabledWizards'].includes(pruned.defense_deck_list[k].wizard_id)) {
                         pruned.defense_deck_list.splice(k, 1);
                    }
               }
               items += pruned.defense_deck_list.length;

               pResp = pruned;
          }

          if (lowerCaseCommand == 'GetGuildMazeContributeList'.toLowerCase()) {
               items = 0;
               pruned = pResp;

               for (var k = pruned.guildmaze_contribute_info_list.length - 1; k >= 0; k--) {
                    if (!apiReference['enabledWizards'].includes(pruned.guildmaze_contribute_info_list[k].wizard_id)) {
                         pruned.guildmaze_contribute_info_list.splice(k, 1);
                    }
               }
               items += pruned.guildmaze_contribute_info_list.length;
               pResp = pruned;
          }

          if (lowerCaseCommand == 'GetGuildMazeBattleLogByWizard'.toLowerCase() || lowerCaseCommand == 'GetGuildMazeBattleLogByTile'.toLowerCase()) {
               items = 0;
               var elementsToPrune = [
                    'log_list'  //array of maze battles 'wizard_id' on each battle---

               ]
               items = 0;
               pruned = pResp;

               for (var k = pruned.log_list.length - 1; k >= 0; k--) {
                    if (!apiReference['enabledWizards'].includes(pruned.log_list[k].wizard_id)) {
                         pruned.log_list.splice(k, 1);
                    }
               }
               items += pruned.log_list.length;
               pResp = pruned;
          }
          if (lowerCaseCommand == 'GetServerGuildWarContributeList'.toLowerCase()) {
               items = 0;
               pruned = pResp;

               for (var k = pruned.contribute_list.length - 1; k >= 0; k--) {
                    if (!apiReference['enabledWizards'].includes(pruned.contribute_list[k].wizard_id)) {
                         pruned.contribute_list.splice(k, 1);
                    }
               }
               items += pruned.contribute_list.length;
               pResp = pruned;
          }

          if (lowerCaseCommand == 'GetServerGuildWarBattleLogByGuild'.toLowerCase()) {
               items = 0;
               pruned = pResp;
               for (var i in pruned.match_log_list) {
                    for (var k = pruned.match_log_list[i].battle_log_list.length - 1; k >= 0; k--) {
                         if (!apiReference['enabledWizards'].includes(pruned.match_log_list[i].battle_log_list[k].wizard_id)) {
                              pruned.match_log_list[i].battle_log_list.splice(k, 1);
                         }
                    }
                    items += pruned.match_log_list[i].battle_log_list.length;
               }
               pResp = pruned;
          }

          if (lowerCaseCommand == 'GetServerGuildWarBattleLogByWizard'.toLowerCase()) {
               items = 0;
               pruned = pResp;
               for (var k = pruned.battle_log_list.length - 1; k >= 0; k--) {
                    for (var j = pruned.battle_log_list[k].length - 1; j >= 0; j--) {
                         if (!apiReference['enabledWizards'].includes(pruned.battle_log_list[k][j].wizard_id)) {
                              pruned.battle_log_list[k].splice(j, 1);
                         }
                    }
               }
               items += pruned.battle_log_list.length;

               pResp = pruned;
          }

          if (lowerCaseCommand == 'getGuildBossContributeList'.toLowerCase()) {
               items = 0;
               pruned = pResp;

               for (var k = pruned.clear_score_info.length - 1; k >= 0; k--) {
                    if (!apiReference['enabledWizards'].includes(pruned.clear_score_info[k].wizard_id)) {
                         pruned.clear_score_info.splice(k, 1);
                    }
               }
               items += pruned.clear_score_info.length;
               pResp = pruned;
          }

          if (lowerCaseCommand == 'getGuildBossBattleLogByWizard'.toLowerCase()) {
               items = 0;
               pruned = pResp;

               for (var k = pruned.clear_score_info.length - 1; k >= 0; k--) {
                    if (!apiReference['enabledWizards'].includes(pruned.clear_score_info[k].wizard_id)) {
                         pruned.clear_score_info.splice(k, 1);
                    }
               }
               items += pruned.clear_score_info.length;
               pResp = pruned;
          }

          if (lowerCaseCommand == 'UpgradeRune'.toLowerCase()) {
               const originalLevel = req.upgrade_curr;
               const newLevel = resp.rune.upgrade_curr;

               if (newLevel <= originalLevel) {
                    return;
               }
          }

          //Clean GetServerGuildWarDefenseDeckList resp
          if (lowerCaseCommand == 'GetServerGuildWarDefenseDeckList'.toLowerCase()) {
               try {
                    for (var root_element_name in resp) {
                         if (root_element_name == "deck_list") {
                              var deck_list = resp[root_element_name];
                              for (var deck_list_index in deck_list) {
                                   var deck_list_child_element = deck_list[deck_list_index];

                                   if (!apiReference['enabledWizards'].includes(deck_list_child_element.wizard_id)) {
                                        return; //Not for an enabled wizard
                                   }

                                   delete deck_list_child_element.total_win_count;
                                   delete deck_list_child_element.total_draw_count;
                                   delete deck_list_child_element.total_lose_count;

                                   delete deck_list_child_element.win_count;
                                   delete deck_list_child_element.draw_count;
                                   delete deck_list_child_element.lose_count;
                              }
                         }
                         if (root_element_name == "round_unit_list") {
                              var round_unit_list = resp[root_element_name];

                              for (var round_unit_list_index in round_unit_list) {
                                   var round_unit_list_child_element = round_unit_list[round_unit_list_index];

                                   for (var round_unit_list_child_element_index in round_unit_list_child_element) {
                                        var round_unit_list_child_element_element = round_unit_list_child_element[round_unit_list_child_element_index];

                                        delete round_unit_list_child_element_element.unit_info.accuracy;
                                        delete round_unit_list_child_element_element.unit_info.artifacts;
                                        delete round_unit_list_child_element_element.unit_info.atk;
                                        delete round_unit_list_child_element_element.unit_info.attribute;
                                        delete round_unit_list_child_element_element.unit_info.awakening_info;
                                        delete round_unit_list_child_element_element.unit_info.building_id;
                                        delete round_unit_list_child_element_element.unit_info.class;
                                        delete round_unit_list_child_element_element.unit_info.con;
                                        delete round_unit_list_child_element_element.unit_info.costume_master_id;
                                        delete round_unit_list_child_element_element.unit_info.create_time;
                                        delete round_unit_list_child_element_element.unit_info.critical_damage;
                                        delete round_unit_list_child_element_element.unit_info.critical_rate;
                                        delete round_unit_list_child_element_element.unit_info.def;
                                        delete round_unit_list_child_element_element.unit_info.exp_gain_rate;
                                        delete round_unit_list_child_element_element.unit_info.exp_gained;
                                        delete round_unit_list_child_element_element.unit_info.experience;
                                        delete round_unit_list_child_element_element.unit_info.homunculus;
                                        delete round_unit_list_child_element_element.unit_info.homunculus_name;
                                        delete round_unit_list_child_element_element.unit_info.island_id;
                                        delete round_unit_list_child_element_element.unit_info.pos_x;
                                        delete round_unit_list_child_element_element.unit_info.pos_y;
                                        delete round_unit_list_child_element_element.unit_info.resist;
                                        delete round_unit_list_child_element_element.unit_info.runes;
                                        delete round_unit_list_child_element_element.unit_info.skills;
                                        delete round_unit_list_child_element_element.unit_info.source;
                                        delete round_unit_list_child_element_element.unit_info.spd;
                                        delete round_unit_list_child_element_element.unit_info.trans_items;
                                        delete round_unit_list_child_element_element.unit_info.unit_index;
                                        delete round_unit_list_child_element_element.unit_info.unit_level;
                                   }
                              }
                         }
                    }
               } catch (e) { }
          }
          if (lowerCaseCommand == 'updateMarker'.toLowerCase()) {
               try {
                    //We need wizard_id from the request object to actually use packet
                    pResp.wizard_id = pReq.wizard_id;
               } catch (e) { }
          }
          if (lowerCaseCommand == 'RemoveRuneLock'.toLowerCase()) {
               try {
                    //We need wizard_id from the request object to actually use packet
                    pResp.wizard_id = pReq.wizard_id;
               } catch (e) { }
          }

          this.writeToFile(proxy, req, pResp, 'SWGT');
          proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "Items:" + `${items}` + "-" + `${resp['command']}` });
          if(checkCache){
               if (this.hasCacheMatch(proxy, config, req, pResp, cacheP)){
                    //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'Item in cache, skipping' });
                    return;
               }
          }
          if (items <= 0) { 
               //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'No items to send, skipping' });
               return 
          };
          this.uploadToWebService(proxy, config, req, pResp, 'SWGT-ProcessRequest');
          pResp = {};

     },
     process3MDCRequest(command, proxy, config, req, resp, cacheP) {
          let lowerCaseCommand = command.toLowerCase();

          if (!config.Config.Plugins[pluginName].uploadBattles) return false;

          if (lowerCaseCommand == 'GetServerGuildWarMatchInfo'.toLowerCase()) {
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it
               try {
                    wizardInfo = {}
                    wizardFound = false;
                    for (var k = wizardBattles.length - 1; k >= 0; k--) {
                         if (wizardBattles[k].wizard_id == req['wizard_id']) {
                              //update rating id
                              wizardBattles[k].guild_rating_id = resp['server_guildwar_match_info']['match_rating_id'];
                              wizardBattles[k].guild_id = resp['server_guildwar_match_info']['guild_id'];
                              wizardBattles[k].guild_name = resp['server_guildwar_match_info']['guild_name'];
                              wizardBattles[k].opp_guild_name = resp['opp_guild_match_info']['guild_name'];
                              wizardBattles[k].sendBattles = [];
                              wizardFound = true;
                         }
                    }
                    if (!wizardFound) {
                         wizardInfo.wizard_id = req['wizard_id'];
                         wizardInfo.guild_name = resp['server_guildwar_match_info']['guild_name'];
                         wizardInfo.guild_rating_id = resp['server_guildwar_match_info']['match_rating_id'];
                         wizardInfo.guild_id = resp['server_guildwar_match_info']['guild_id'];
                         wizardInfo.opp_guild_name = resp['opp_guild_match_info']['guild_name'];
                         wizardInfo.sendBattles = [];
                         wizardBattles.push(wizardInfo);
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
               try {
                    if (worldGuildBattleGuildRanking.has(resp.server_guildwar_match_info.guild_id) == false)
                         worldGuildBattleGuildRanking.set(resp.server_guildwar_match_info.guild_id, resp.server_guildwar_match_info.match_rating_id);
               } catch (e) { }
          }
          if (lowerCaseCommand == 'GetGuildSiegeRankingInfo'.toLowerCase()) {
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it
               try {
                    wizardInfo = {}
                    wizardFound = false;
                    for (var k = wizardBattles.length - 1; k >= 0; k--) {
                         if (wizardBattles[k].wizard_id == req['wizard_id']) {
                              //update rating id
                              wizardBattles[k].siege_rating_id = resp['guildsiege_ranking_info']['rating_id'];
                              wizardBattles[k].guild_id = resp['guildsiege_ranking_info']['guild_id'];
                              wizardBattles[k].sendBattles = [];
                              wizardFound = true;
                         }
                    }
                    if (!wizardFound) {
                         wizardInfo.wizard_id = req['wizard_id'];
                         wizardInfo.siege_rating_id = resp['guildsiege_ranking_info']['rating_id'];
                         wizardInfo.guild_id = resp['guildsiege_ranking_info']['guild_id'];
                         wizardInfo.sendBattles = [];
                         wizardBattles.push(wizardInfo);
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
               try {
                    siegeGuildRanking.set(resp.guildsiege_ranking_info.guild_id, resp.guildsiege_ranking_info.rating_id);
               } catch (e) { }
          }
          if (lowerCaseCommand == 'GetServerGuildWarParticipationInfo'.toLowerCase()) {
               try {
                    worldGuildBattleGuildRanking.set(resp.ranking_info.guild_id, resp.ranking_info.rating_id);
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
               return;
          }
          if (lowerCaseCommand == 'GetGuildSiegeMatchupInfo'.toLowerCase()) {
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it
               try {
                    wizardInfo = {}
                    wizardFound = false;
                    for (var k = wizardBattles.length - 1; k >= 0; k--) {
                         if (wizardBattles[k].wizard_id == req['wizard_id']) {
                              wizardBattles[k].siege_rating_id = resp['match_info']['rating_id'];

                              //clear attack and defense lists on new siege matchid for a specific wizard (to allow for multiple guilds being watched by the same plugin)
                              if (wizardBattles[k].match_id != resp['match_info']['match_id']) {
                                   wizardBattles[k].observerDefenseInfo = [];
                                   wizardBattles[k].observerAttackerList = [];
                              }
                              wizardBattles[k].match_id = resp['match_info']['match_id'];
                              for (var wizard in resp['wizard_info_list']) {
                                   if (resp['wizard_info_list'][wizard].wizard_id == req['wizard_id']) {
                                        wizardBattles[k].guild_id = resp['wizard_info_list'][wizard].guild_id;
                                   }
                              }
                              wizardBattles[k].sendBattles = [];
                              wizardFound = true;
                         }
                    }
                    if (!wizardFound) {
                         wizardInfo.wizard_id = req['wizard_id'];
                         wizardInfo.siege_rating_id = resp['match_info']['rating_id'];
                         wizardInfo.match_id = resp['match_info']['match_id'];
                         wizardInfo.observerDefenseInfo = [];
                         wizardInfo.observerAttackerList = [];
                         for (var wizard in resp['wizard_info_list']) {
                              if (resp['wizard_info_list'][wizard].wizard_id == req['wizard_id']) {
                                   wizardInfo.guild_id = resp['wizard_info_list'][wizard].guild_id;
                              }
                         }
                         wizardInfo.sendBattles = [];
                         wizardBattles.push(wizardInfo);
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }
          if (lowerCaseCommand == 'BattleServerGuildWarStart'.toLowerCase() || lowerCaseCommand == 'BattleServerGuildWarStartVirtual'.toLowerCase()) {
               //Store only the information needed for transfer
               try {
                    k = 0;
                    //match up wizard id and push the battle
                    for (var kindex = wizardBattles.length - 1; kindex >= 0; kindex--) {
                         if (wizardBattles[kindex].wizard_id == req['wizard_id']) {
                              //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Test Server GW Start-Found Index- ${resp['command']}` });
                              k = kindex;
                              kindex = -1;
                         }
                    }
                    for (var i = 0; i < 5; i++) {
                         battle = {}
                         battle.command = "3MDCBattleLog";
                         battle.battleType = "WorldGuildBattle";
                         battle.wizard_id = resp.wizard_info.wizard_id;
                         battle.wizard_name = resp.wizard_info.wizard_name;
                         battle.battleKey = resp.battle_key;
                         battle.battleIndex = i;
                         battle.battleStartTime = resp.tvalue;
                         battle.defense = {}
                         battle.counter = {}
                         battle.opp_guild_id = resp.target_base_info.guild_id;
                         battle.opp_wizard_id = resp.target_base_info.wizard_id;
                         battle.opp_wizard_name = resp.target_base_info.wizard_name;
                         battle.battleRank = wizardBattles[k].guild_rating_id;
                         battle.guild_id = wizardBattles[k].guild_id;
                         battle.opp_guild_name = wizardBattles[k].opp_guild_name;
                         battle.guild_name = wizardBattles[k].guild_name;

                         //prepare the arrays
                         units = [];
                         battle.defense.units = [];
                         battle.counter.units = [];
                         battle.counter.unique = [];
                         for (var j = 0; j < 3; j++) {
                              try {
                                   //Offense Mons
                                   battle.counter.unique.push(resp.unit_id_list[i][j]); //unique monster id ''
                                   //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp.unit_id_list[i][j]}-Counter List-${i}-${j}-${wizardBattles[k].monsterIDMap?.[resp.unit_id_list[i][j]]}` });
                                   if (wizardBattles[k].monsterIDMap?.[resp.unit_id_list[i][j]] !== undefined) {
                                        counterUnit = wizardBattles[k].monsterIDMap[resp.unit_id_list[i][j]];
                                   } else {
                                        counterUnit = -99999;
                                   }
                                   battle.counter.units.push(counterUnit);

                                   //Defense Mons
                                   iDefense = (i + 1).toString();
                                   battle.defense.units.push(resp.opp_unit_list[iDefense].unit_list[j].unit_info.unit_master_id);
                              } catch (e) {
                                   proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-Counter Prep-${e.message}` });
                              }
                         }

                         wizardBattles[k].sendBattles.push(battle);
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }
          if (lowerCaseCommand == 'BattleGuildSiegeStart_v2'.toLowerCase()) {
               try {
                    battle = {}
                    battle.command = "3MDCBattleLog";
                    battle.battleType = "Siege";
                    battle.wizard_id = resp.wizard_info.wizard_id;
                    battle.wizard_name = resp.wizard_info.wizard_name;
                    battle.battleKey = resp.battle_key;
                    battle.battleStartTime = resp.tvalue;
                    battle.defense = {}
                    battle.counter = {}

                    //prepare the arrays
                    units = [];
                    battle.defense.units = [];
                    battle.counter.units = [];
                    battle.counter.unique = [];
                    for (var j = 0; j < 3; j++) {
                         try {
                              //Defense Mons
                              battle.defense.units.push(resp.guildsiege_opp_unit_list[j].unit_info.unit_master_id);
                              //Offense Mons
                              battle.counter.units.push(resp.guildsiege_my_unit_list[j].unit_master_id);
                              battle.counter.unique.push(resp.guildsiege_my_unit_list[j].unit_id);

                         } catch (e) { }
                    }
                    //match up wizard id and push the battle
                    for (var k = wizardBattles.length - 1; k >= 0; k--) {
                         if (wizardBattles[k].wizard_id == req['wizard_id']) {
                              //store battle in array
                              battle.battleRank = wizardBattles[k].siege_rating_id;
                              battle.guild_id = wizardBattles[k].guild_id;
                              wizardBattles[k].sendBattles.push(battle);
                         }
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }
          if (lowerCaseCommand == 'BattleServerGuildWarRoundResult'.toLowerCase()) {
               //store battle start time for second battle and end time for first battle
               var j = req['round_id'] - 1;
               try {//Handle out of order processing
                    for (var wizard in wizardBattles) {
                         //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle Round Wizard Search ${wizard}` });
                         for (var k = wizardBattles[wizard].sendBattles.length - 1; k >= 0; k--) {
                              if (wizardBattles[wizard].sendBattles[k].wizard_id == req['wizard_id']) {
                                   //if (j==1){wizardBattles[wizard].sendBattles[k].battleStartTime = resp.tvalue};
                                   if (j == k) {
                                        proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle Round ${j + 1} Saved` });
                                        wizardBattles[wizard].sendBattles[k].battleDateTime = resp.tvalue;

                                        //sendResp = wizardBattles[wizard].sendBattles[k];
                                        if (j < 4) { wizardBattles[wizard].sendBattles[k + 1].battleStartTime = resp.tvalue };
                                        //if (sendResp.defense.units.length == 3 && sendResp.counter.units.length > 0 && sendResp.battleRank >= 1000) {
                                        //this.writeToFile(proxy, req, sendResp,'3MDCProgress-'+j);
                                        //}
                                   }
                              }
                         }
                    }
                    //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle Round End Test ${j}` });
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle Round End Error ${e.message}` });
               }
               if (j == 1) {
                    j = 0;
               }
          }

          if (lowerCaseCommand == 'BattleServerGuildWarResult'.toLowerCase() || lowerCaseCommand == 'BattleServerGuildWarResultVirtual'.toLowerCase()) {
               var j = 5;
               try {//Handle out of order processing
                    for (var wizard in wizardBattles) {

                         for (var k = wizardBattles[wizard].sendBattles.length - 1; k >= 0; k--) {
                              //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle End Loop ${k} ${req['win_lose_list'][j]}` });
                              if (wizardBattles[wizard].sendBattles[k].wizard_id == req['wizard_id']) {


                                   jstr = j.toString();
                                   wizardBattles[wizard].sendBattles[k].win_lose = req['win_lose_list'][jstr];
                                   wizardBattles[wizard].sendBattles[k].attacker_server_id = resp['attack_info']['server_id'];
                                   wizardBattles[wizard].sendBattles[k].opp_server_id = resp['target_base_info']['server_id'];
                                   if ('server_id' in resp)
                                        wizardBattles[wizard].sendBattles[k].swex_server_id = resp['server_id'];
                                   if (j == 5) { wizardBattles[wizard].sendBattles[k].battleDateTime = resp.tvalue };
                                   j--;
                                   sendResp = wizardBattles[wizard].sendBattles[k];
                                   //remove battle from the sendBattlesList
                                   wizardBattles[wizard].sendBattles.splice(k, 1);
                                   //if result then add time and win/loss then send to webservice
                                   this.writeToFile(proxy, req, sendResp, '3MDCPersonal-' + k);
                                   if (sendResp.defense.units.length == 3 && sendResp.counter.units.length > 0 && sendResp.battleRank >= 1000) {

                                        if (this.verifyPacketToSend(proxy, config, req, sendResp)) {
                                             this.uploadToWebService(proxy, config, req, sendResp, '3MDC');
                                        }
                                        proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle Round End Processed ${k + 1}` });
                                   }
                              }
                              //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle End Test ${k}` });
                         }
                    }
                    //proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle End Test 2` });

               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Server GW Battle End Error ${e.message}` });
               }
               if (j == 1) {
                    j = 0;
               }
          }

          if (lowerCaseCommand == 'BattleGuildSiegeResult'.toLowerCase()) {
               var j = 0;
               try {//Handle out of order processing
                    for (var wizard in wizardBattles) {
                         for (var k = wizardBattles[wizard].sendBattles.length - 1; k >= 0; k--) {
                              //Handle multiple accounts with GW and Siege going at the same time. match battlekey and wizard. then do battles 1 and 2 and delete from the mon list.
                              if (wizardBattles[wizard].sendBattles[k].battleKey == req['battle_key']) {
                                   wizardBattles[wizard].sendBattles[k].win_lose = req['win_lose'];
                                   wizardBattles[wizard].sendBattles[k].battleDateTime = resp.tvalue - j;
                                   if ('server_id' in resp)
                                        wizardBattles[wizard].sendBattles[k].swex_server_id = resp['server_id'];
                                   j++;
                                   sendResp = wizardBattles[wizard].sendBattles[k];
                                   //remove battle from the sendBattlesList
                                   wizardBattles[wizard].sendBattles.splice(k, 1);
                                   //if 3 mons in offense and defense then send to webservice
                                   if (sendResp.defense.units.length == 3 && sendResp.counter.units.length > 0 && sendResp.battleRank >= 1000) {
                                        this.writeToFile(proxy, req, sendResp, '3MDC-' + k);
                                        if (this.verifyPacketToSend(proxy, config, req, sendResp)) {
                                             this.uploadToWebService(proxy, config, req, sendResp, '3MDC');
                                        }
                                        proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Siege Battle End Processed ${k}` });
                                   }
                              }
                         }
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Siege Battle End Error ${e.message}` });
               }
               if (j == 1) {
                    j = 0;
               }
          }

          if (lowerCaseCommand == 'SetGuildSiegeBattleReplayData'.toLowerCase()) {
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it
               try {
                    wizardInfo = {}
                    wizardFound = false;
                    for (var k = wizardBattles.length - 1; k >= 0; k--) {
                         if (wizardBattles[k].wizard_id == req.battle_info.wizard_id) {
                              wizardBattles[k].sendBattles = [];
                              wizardFound = true;
                         }
                    }
                    if (!wizardFound) {
                         wizardInfo.wizard_id = req.battle_info.wizard_id;
                         wizardInfo.sendBattles = [];
                         wizardBattles.push(wizardInfo);
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
               try {
                    if (req.battle_info.guild_id == req.battle_info.opp_guild_id) {
                         battle = {}
                         battle.command = "3MDCBattleLog";
                         battle.battleType = "SiegeTest";
                         battle.wizard_id = req.battle_info.wizard_id;
                         battle.wizard_name = req.battle_info.wizard_name;
                         battle.battleKey = req.battle_key;
                         battle.guild_id = req.battle_info.guild_id;
                         battle.guild_name = req.battle_info.guild_name;
                         battle.opp_wizard_id = req.battle_info.opp_wizard_id;
                         battle.opp_wizard_name = req.battle_info.opp_wizard_name;
                         battle.battleRank = siegeGuildRanking.get(battle.guild_id);
                         battle.defense = {}
                         battle.counter = {}

                         battle.battleDateTime = resp.tvalue;
                         if ('server_id' in resp)
                              battle.swex_server_id = resp['server_id'];
                         battle.win_lose = req.battle_info.result_list[0];

                         //prepare the arrays
                         battle.defense.units = [];
                         battle.counter.units = [];

                         //Defense Mons
                         for (var j = 0; j < 3; j++) {
                              try {
                                   battle.defense.units.push(req.battle_info.opp_unit_list[0][j]);
                              } catch (e) { }
                         }

                         //Offense Mons
                         for (var j = 0; j < 3; j++) {
                              try {
                                   battle.counter.units.push(req.battle_info.unit_list[0][j]);
                              } catch (e) { }
                         }

                         //match up wizard id and push the battle
                         for (var k = wizardBattles.length - 1; k >= 0; k--) {
                              if (wizardBattles[k].wizard_id == req['wizard_id']) {
                                   battle.battleRank = wizardBattles[k].siege_rating_id;
                                   wizardBattles[k].sendBattles.push(battle);
                              }
                         }

                         //if 3 mons in defense and at least one counter and rank is F1+ then send to webservice
                         if (battle.defense.units.length == 3 && battle.counter.units.length > 0 && battle.battleRank >= 2000) {
                              this.writeToFile(proxy, req, battle, '3MDC-SiegeTest-');
                              this.uploadToWebService(proxy, config, req, battle, '3MDC');
                              proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Siege Test Battle Processed` });
                         }
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }

          if (lowerCaseCommand == 'SetServerGuildWarBattleReplayData'.toLowerCase()) {
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it
               try {
                    wizardInfo = {}
                    wizardFound = false;
                    for (var k = wizardBattles.length - 1; k >= 0; k--) {
                         if (wizardBattles[k].wizard_id == req.battle_info.wizard_id) {
                              wizardBattles[k].sendBattles = [];
                              wizardFound = true;
                         }
                    }
                    if (!wizardFound) {
                         wizardInfo.wizard_id = req.battle_info.wizard_id;
                         wizardInfo.sendBattles = [];
                         wizardBattles.push(wizardInfo);
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
               try {
                    if (req.battle_info.guild_id == req.battle_info.opp_guild_id) {
                         battle = {}
                         battle.command = "3MDCBattleLog";
                         battle.battleType = "WorldGuildBattleTest";
                         battle.wizard_id = req.battle_info.wizard_id;
                         battle.wizard_name = req.battle_info.wizard_name;
                         battle.battleKey = req.battle_key;
                         battle.guild_id = req.battle_info.guild_id;
                         battle.guild_name = req.battle_info.guild_name;
                         battle.attacker_server_id = req.battle_info.server_type;
                         battle.opp_wizard_id = req.battle_info.opp_wizard_id;
                         battle.opp_wizard_name = req.battle_info.opp_wizard_name;
                         battle.opp_guild_id = req.battle_info.opp_guild_id;
                         battle.opp_guild_name = req.battle_info.opp_guild_name;
                         battle.opp_server_id = req.battle_info.opp_server_type;
                         battle.battleRank = worldGuildBattleGuildRanking.get(battle.guild_id);
                         battle.defense = {}
                         battle.counter = {}

                         battle.battleDateTime = resp.tvalue;
                         if ('server_id' in resp)
                              battle.swex_server_id = resp['server_id'];
                         battle.win_lose = req.battle_info.result_list[0];

                         //prepare the arrays
                         battle.defense.units = [];
                         battle.counter.units = [];

                         //Defense Mons
                         for (var j = 0; j < 3; j++) {
                              try {
                                   battle.defense.units.push(req.battle_info.opp_unit_list[0][j]);
                              } catch (e) { }
                         }

                         //Offense Mons
                         for (var j = 0; j < 3; j++) {
                              try {
                                   battle.counter.units.push(req.battle_info.unit_list[0][j]);
                              } catch (e) { }
                         }
                         //if 3 mons in defense and at least one counter and rank is G1+ then send to webservice
                         if (battle.defense.units.length == 3 && battle.counter.units.length > 0 && battle.battleRank >= 4000) {
                              this.writeToFile(proxy, req, battle, '3MDC-WGBTest-');
                              this.uploadToWebService(proxy, config, req, battle, '3MDC');
                              proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `WGB Test Battle Processed` });
                         }
                    }
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }

     },
     processSWGTHistoryRequest(command, proxy, config, req, resp, cacheP) {
          let lowerCaseCommand = command.toLowerCase();

          //Populate the Defense_Deck Table
          if (lowerCaseCommand == 'GetGuildSiegeBaseDefenseUnitList'.toLowerCase() || lowerCaseCommand == 'GetGuildSiegeBaseDefenseUnitListPreset'.toLowerCase() || lowerCaseCommand == 'GetGuildSiegeDefenseDeckByWizardId'.toLowerCase()) {
               if (!this.verifyPacketToSend(proxy, config, req, resp)) return;
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it
               try {
                    defenseInfo = {}
                    tempDefenseDeckInfo = [];
                    sendDecks = {}
                    defenseFound = false;
                    items = 0;
                    for (var deck in resp['defense_deck_list']) {
                         //Limit defense deck additions to only approved wizardID
                         if (apiReference.enabledWizards.includes(resp['defense_deck_list'][deck].wizard_id)) {
                              defenseInfo = {};
                              defenseInfo.wizard_id = resp['defense_deck_list'][deck].wizard_id;
                              defenseInfo.deck_id = resp['defense_deck_list'][deck].deck_id;
                              unitCount = 0;
                              for (var defenseUnit in resp['defense_unit_list']) {
                                   if (defenseInfo.deck_id == resp['defense_unit_list'][defenseUnit].deck_id && resp['defense_unit_list'][defenseUnit].pos_id == 1 && resp['defense_unit_list'][defenseUnit].hasOwnProperty('unit_info')) {
                                        defenseInfo.uniqueMon1 = resp['defense_unit_list'][defenseUnit].unit_info.unit_id;
                                        defenseInfo.mon1 = resp['defense_unit_list'][defenseUnit].unit_info.unit_master_id;
                                        unitCount++;
                                   }
                                   if (defenseInfo.deck_id == resp['defense_unit_list'][defenseUnit].deck_id && resp['defense_unit_list'][defenseUnit].pos_id == 2 && resp['defense_unit_list'][defenseUnit].hasOwnProperty('unit_info')) {
                                        defenseInfo.uniqueMon2 = resp['defense_unit_list'][defenseUnit].unit_info.unit_id;
                                        defenseInfo.mon2 = resp['defense_unit_list'][defenseUnit].unit_info.unit_master_id;
                                        unitCount++;
                                   }
                                   if (defenseInfo.deck_id == resp['defense_unit_list'][defenseUnit].deck_id && resp['defense_unit_list'][defenseUnit].pos_id == 3 && resp['defense_unit_list'][defenseUnit].hasOwnProperty('unit_info')) {
                                        defenseInfo.uniqueMon3 = resp['defense_unit_list'][defenseUnit].unit_info.unit_id;
                                        defenseInfo.mon3 = resp['defense_unit_list'][defenseUnit].unit_info.unit_master_id;
                                        unitCount++;
                                   }
                              }
                              //sort mon2 and mon3
                              if (unitCount == 3) {
                                   if (defenseInfo.mon3 < defenseInfo.mon2) {
                                        tempMon = defenseInfo.uniqueMon2;
                                        tempMon2 = defenseInfo.mon2;
                                        defenseInfo.uniqueMon2 = defenseInfo.uniqueMon3;
                                        defenseInfo.mon2 = defenseInfo.mon3;
                                        defenseInfo.uniqueMon3 = tempMon;
                                        defenseInfo.mon3 = tempMon2;

                                   }
                                   defenseInfo.deckPrimaryKey = defenseInfo.wizard_id.toString() + "_" + defenseInfo.uniqueMon1.toString() + "_" + defenseInfo.uniqueMon2.toString() + "_" + defenseInfo.uniqueMon3.toString();

                                   tempDefenseDeckInfo.push(defenseInfo)
                              }
                         }
                    }
                    sendDecks.command = "SWGTSiegeDeckUnits";
                    sendDecks.deck_units = tempDefenseDeckInfo;
                    sendResp = sendDecks;
                    items = sendDecks.deck_units.length - 1;
                    this.writeToFile(proxy, req, sendResp, 'SWGT2-');
                    if (this.hasCacheMatch(proxy, config, req, sendResp, cacheP)) return;
                    if (items <= 0) return;
                    this.uploadToWebService(proxy, config, req, sendResp, 'SWGT-history');
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }

          //Populate the Defense_Deck Log Matching Table

          if (lowerCaseCommand == 'GetGuildSiegeBattleLogByDeckId'.toLowerCase()) {
               //If wizard id and rating doesn't exist in wizardBattles[] then push to it

               try {
                    targetdeckid = req['target_deck_id'];
                    sendDecks = {}
                    deckLogLink = []
                    deckwizardID = 0;

                    //find the deckid info that matches in the tempDefenseDeckInfo
                    for (var k = tempDefenseDeckInfo.length - 1; k >= 0; k--) {
                         if (tempDefenseDeckInfo[k].deck_id == req['target_deck_id']) {
                              deckIDPrimaryKey = tempDefenseDeckInfo[k].wizard_id.toString() + "_" + tempDefenseDeckInfo[k].uniqueMon1.toString() + "_" + tempDefenseDeckInfo[k].uniqueMon2.toString() + "_" + tempDefenseDeckInfo[k].uniqueMon3.toString();
                              deckwizardID = tempDefenseDeckInfo[k].wizard_id;
                         }
                    }
                    for (var siegewar in resp['log_list']) {
                         for (var battleLog in resp['log_list'][siegewar].battle_log_list) {
                              //add each battle to deckLogLink
                              if (deckwizardID == resp['log_list'][siegewar].battle_log_list[battleLog].wizard_id) {
                                   deckLogValues = {}
                                   deckLogValues.deckIDPrimaryKey = deckIDPrimaryKey;
                                   deckLogValues.wizard_id = resp['log_list'][siegewar].battle_log_list[battleLog].wizard_id;
                                   deckLogValues.wizard_name = resp['log_list'][siegewar].battle_log_list[battleLog].wizard_name;
                                   deckLogValues.opp_wizard_id = resp['log_list'][siegewar].battle_log_list[battleLog].opp_wizard_id;
                                   deckLogValues.opp_wizard_name = resp['log_list'][siegewar].battle_log_list[battleLog].opp_wizard_name;
                                   deckLogValues.win_lose = resp['log_list'][siegewar].battle_log_list[battleLog].win_lose;
                                   deckLogValues.log_type = resp['log_list'][siegewar].battle_log_list[battleLog].log_type;
                                   deckLogValues.log_timestamp = resp['log_list'][siegewar].battle_log_list[battleLog].log_timestamp;
                                   deckLogValues.linkPrimaryKey = deckLogValues.wizard_id + "_" + deckLogValues.opp_wizard_id + "_" + deckLogValues.log_timestamp
                                   deckLogLink.push(deckLogValues)
                              }
                         }
                    }
                    sendDecks.command = "SWGTSiegeDeckHistoryLink";
                    sendDecks.deck_log_history = deckLogLink;
                    sendResp = sendDecks;
                    this.writeToFile(proxy, req, sendResp, 'SWGTPersonal3-');
                    if (this.hasCacheMatch(proxy, config, req, sendResp, cacheP)) return;
                    this.uploadToWebService(proxy, config, req, sendResp, 'SWGT-history');
               } catch (e) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
               }
          }
     },

     verifyPacketToSend(proxy, config, req, resp) {
          verifyCheck = true;
          if ('wizard_id' in req) {
               var i = apiReference.enabledWizards.length;
               while (i--) {
                    if (apiReference.enabledWizards[i] === req.wizard_id) {
                         verifyCheck = true;
                         i = 0;
                    } else {
                         verifyCheck = false;
                    }
               }
          } else {
               verifyCheck = true;
          }
          proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "Verify User: " + `${verifyCheck}` + "-" + `${resp['command']}` });
          return verifyCheck;
     },
     hasCacheMatch(proxy, config, req, resp, cacheP) {
          if (!this.hasAPISettings(config, proxy)) return false;
          var respCopy = structuredClone(resp);
          let lowerCaseCommand = respCopy['command'];
          if(lowerCaseCommand)
               lowerCaseCommand = lowerCaseCommand.toLowerCase();

          //Remove stuff that is auto generated, time stamp or request related
          if ('log_type' in respCopy) { lowerCaseCommand += '_' + respCopy['log_type'] };
          if ('ts_val' in respCopy) { delete respCopy['ts_val'] };
          if ('tvalue' in respCopy) { delete respCopy['tvalue'] };
          if ('tvaluelocal' in respCopy) { delete respCopy['tvaluelocal'] };
          if ('reqid' in respCopy) { delete respCopy['reqid'] };
          if ('date_time_stamp' in respCopy) { delete respCopy['date_time_stamp'] };

          if ((lowerCaseCommand in cacheP) == false) {
               proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "Not in cache:  " + lowerCaseCommand });
          } else {
               var respTest = JSON.stringify(respCopy);
               var cacheTest = JSON.stringify(cacheP[lowerCaseCommand]);
               if (cacheTest === respTest) {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "Matched cache:  " + lowerCaseCommand });
                    return true;
               } else {
                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "No match cache:  " + lowerCaseCommand });
               }
               for (var k in cachePTimerSettings) {
                    if (cachePTimerSettings[k].command === lowerCaseCommand) {
                         var currentTime = new Date().getTime();
                         var timeDifference = currentTime - cachePDuration[lowerCaseCommand];
                         if (timeDifference < cachePTimerSettings[k].timer) {
                              timerMinutes = cachePTimerSettings[k].timer / 60000;
                              proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "Time between last packet < " + timerMinutes + " minute(s) for:  " + lowerCaseCommand });
                              return true;
                         }
                    }
               }
          };

          cacheP[lowerCaseCommand] = respCopy;
          cachePDuration[lowerCaseCommand] = new Date().getTime();

          return false;
     },
     hasAPICommandMatch(proxy, config, req, resp) {
          //TODO:send api call to site for specific commands to allow for multiple users to not send the same packet every time it is requested
     },
     uploadToWebService(proxy, config, req, resp, endpointType) {
          if (!config.Config.Plugins[pluginName].enabled){
               //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'Plugin disabled, skipping' });
               return false;
          }
          if (!this.hasAPISettings(config, proxy)){
               //proxy.log({ type: 'DEBUG', source: 'plugin', name: this.pluginName, message: 'No API settings, skipping' });
               return;
          }

          const { command } = resp;
          resp.pluginVersion = version;
          var endpoint = "/api/personal/swgt/v1";
          if ("3MDC" == endpointType) {
               endpoint = "/api/personal/3mdc/v1";
          }
          let options = {
               method: 'post',
               uri: siteURL + endpoint + '?apiKey=' + config.Config.Plugins[pluginName].apiKey,
               json: true,
               body: resp
          };

          request(options, (error, response) => {
               if (error) {
                    proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Error: ${error.message}` });
                    return;
               }

               if (response.statusCode === 200) {
                    proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: `${command} uploaded successfully` });
               } else {
                    proxy.log({
                         type: 'error',
                         source: 'plugin',
                         name: this.pluginName,
                         message: `${command} upload failed: Server responded with code: ${response.statusCode} = ${response.body.message} for ${command} to ${siteURL}${endpoint}`
                    });

                    //Remove from cache if rate limited
                    try {
                         if (response.body.includes("updated in the past")) {
                              let lowerCaseCommand = resp['command'];
                              if(lowerCaseCommand)
                                   lowerCaseCommand = lowerCaseCommand.toLowerCase();

                              delete cacheP[lowerCaseCommand];
                         }
                    } catch (error) { }
               }

               
               //Update enabled wizards, subscription tiers, etc.
               try {
                    if('messageType' in response.body){
                         siteAPIResponse = response.body;
                         //if ('messageType' in siteAPIResponse) { apiReference.messageType = siteAPIResponse.messageType };

                         if ('updatePermissions' in siteAPIResponse && siteAPIResponse.updatePermissions) {
                              if ('enabledWizards' in siteAPIResponse) { apiReference.enabledWizards = siteAPIResponse.enabledWizards };

                              if ('isSWGTPersonalSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalSubscriber = siteAPIResponse.isSWGTPersonalSubscriber };
                              if ('isSWGTPersonalPlusSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalPlusSubscriber = siteAPIResponse.isSWGTPersonalPlusSubscriber };
                              
                              if ('swgtPersonalSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalSubscriber = siteAPIResponse.swgtPersonalSubscriber };
                              if ('swgtPersonalPlusSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalPlusSubscriber = siteAPIResponse.swgtPersonalPlusSubscriber };
                              
                              if ('swgtpersonalSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalSubscriber = siteAPIResponse.swgtpersonalSubscriber };
                              if ('swgtpersonalPlusSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalPlusSubscriber = siteAPIResponse.swgtpersonalPlusSubscriber };
                         }
                    }
               } catch (error) { }
          });
     },
     checkVersion(proxy) {
          //check version number
          var endpoint = "/api/personal/swgt/v1";
          let options = {
               method: 'get',
               uri: siteURL + endpoint
          };
          request(options, (error, response) => {
               if (error) {
                    proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Error: ${error.message}` });
                    return;
               }
               //Check current version of SWGT Plugin as listed on site.
               if (response.statusCode === 200) {
                    versionResponse = JSON.parse(response.body);
                    if (versionResponse.message == version) {
                         proxy.log({
                              type: 'success', source: 'plugin', name: this.pluginName,
                              message: `Initializing version ${pluginName}_${version}. You have the latest version!`
                         });
                    } else {
                         proxy.log({
                              type: 'warning', source: 'plugin', name: this.pluginName,
                              message: `Initializing version ${pluginName}_${version}. There is a new version available on GitHub. Please visit https://github.com/Cerusa/swgt-personal-swex-plugin/releases and download the latest version.`
                         });
                    }
               } else {
                    proxy.log({
                         type: 'error',
                         source: 'plugin',
                         name: this.pluginName,
                         message: `Server responded with code: ${response.statusCode} = ${response.body}`
                    });
               }
          });
     },
     checkSiteAPI(proxy, config) {
          //check site api configuration settings
          if (!this.hasAPIEnabled(config, proxy)) {
               //proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `API Settings not yet configured.` });
               return;
          }
          resp = {};
          resp.command = "checkAPIKey";
          var endpoint = "/api/personal/swgt/v1";

          let options = {
               method: 'post',
               uri: siteURL + endpoint + '?apiKey=' + config.Config.Plugins[pluginName].apiKey,
               json: true,
               body: resp
          };
          proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `options url: ${options.uri}` });
          request(options, (error, response) => {
               if (error) {
                    proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Failed to connect to ${siteURL}` });
                    return;
               }

               if (response.statusCode === 200) {
                    proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: `Successfully connected to ${siteURL}` });
                    //load local apiCheck here
                    siteAPIResponse = response.body;
                    if ('messageType' in siteAPIResponse) { apiReference.messageType = siteAPIResponse.messageType };
                    if ('enabledWizards' in siteAPIResponse) { apiReference.enabledWizards = siteAPIResponse.enabledWizards };

                    if ('isSWGTPersonalSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalSubscriber = siteAPIResponse.isSWGTPersonalSubscriber };
                    if ('isSWGTPersonalPlusSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalPlusSubscriber = siteAPIResponse.isSWGTPersonalPlusSubscriber };
                    
                    if ('swgtPersonalSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalSubscriber = siteAPIResponse.swgtPersonalSubscriber };
                    if ('swgtPersonalPlusSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalPlusSubscriber = siteAPIResponse.swgtPersonalPlusSubscriber };
                    
                    if ('swgtpersonalSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalSubscriber = siteAPIResponse.swgtpersonalSubscriber };
                    if ('swgtpersonalPlusSubscriber' in siteAPIResponse) { apiReference.isSWGTPersonalPlusSubscriber = siteAPIResponse.swgtpersonalPlusSubscriber };

                    proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `apiReference: ${apiReference.messageType}` });
               } else if (response.statusCode === 401) {
                    proxy.log({
                         type: 'error',
                         source: 'plugin',
                         name: this.pluginName,
                         message: `Failed to connect to ${siteURL}: Invalid API Key.`
                    });
               } else {
                    proxy.log({
                         type: 'error',
                         source: 'plugin',
                         name: this.pluginName,
                         message: `Failed to connect to ${siteURL}. ${response.body.message}`
                    });
               }
          });
     },

     writeToFile(proxy, req, resp, prefix) {
          resp.pluginVersion = version;

          if (!config.Config.Plugins[pluginName].enabled) return;
          if (!config.Config.Plugins[pluginName].saveToFile) return;
          let filename = this.pluginName + '-' + prefix + '-' + resp['command'] + '-' + new Date().getTime() + '.json';
          let outFile = fs.createWriteStream(path.join(config.Config.App.filesPath, filename), {
               flags: 'w',
               autoClose: true
          });

          outFile.write(JSON.stringify(resp, true, 2));
          outFile.end();
          proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: 'Saved data to '.concat(filename) });
     }
};