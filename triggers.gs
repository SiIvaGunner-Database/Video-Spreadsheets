// Deletes and rebuilds all triggers in the current project
function resetTriggers()
{
  var triggers = ScriptApp.getProjectTriggers();
  
  for (var i in triggers)
    ScriptApp.deleteTrigger(triggers[i]);

  ScriptApp.newTrigger('checkSheet')
    .timeBased()
    .everyMinutes(10)
    .create();

  ScriptApp.newTrigger('checkPublicVideos')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  ScriptApp.newTrigger('checkDatabase')
    .timeBased()
    .everyHours(12)
    .create();

  ScriptApp.newTrigger('updateDatabase')
    .timeBased()
    .everyHours(4)
    .create();
}
