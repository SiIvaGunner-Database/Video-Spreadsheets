/**
 * Deletes and recreates project triggers.
 */
function resetTriggers() {

  var triggers = ScriptApp.getProjectTriggers();
  
  for (var i in triggers) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('checkRecentVideos')
    .timeBased()
    .everyMinutes(10)
    .create();

  ScriptApp.newTrigger('checkVideoDetails')
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .create();

  ScriptApp.newTrigger('checkVideoDatabase')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();

  ScriptApp.newTrigger('checkVideoStatuses')
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .create();

  ScriptApp.newTrigger('checkWikiStatuses')
    .timeBased()
    .everyMinutes(60)
    .create();

}
