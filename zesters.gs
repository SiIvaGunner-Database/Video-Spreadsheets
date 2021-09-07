function addVideos() {
  var ids = ["5P_6hVlr36M"];
  var channel = "";
  var channelId = 1;

  addRipsToSheet(ids);
  addRipsToDatabase(ids);
}

function checkForZero() {
  var videoId = "jdFtn_9QhBU";

  try {
    var videoResponse = YouTube.Videos.list('snippet,statistics', {id: videoId, maxResults: 1, type: 'video'});

    var item = videoResponse.items[0];

    var commentCount = item.statistics.commentCount;

    commentCount = "";

    Logger.log(commentCount);

    if (!commentCount)
      commentCount = 0;

    Logger.log(commentCount);
  }
  catch(e) {
    Logger.log(e);
  }
}

function fixTimes() {
  var row = 1;
  var col = 6;
  var sheet = SpreadsheetApp.openById("1EKQq1K8Bd7hDlFMg1Y5G_a2tWk_FH39bgniUUBGlFKM").getSheetByName("Statuses");
  var dates = sheet.getRange("F2:F").getValues();

  for (var i in dates) {
    row++;
    if (row > 687) {
      var date = new Date(dates[i]);
      Logger.log(row + ": " + date);
      date.setHours(date.getHours() + 7);
      Logger.log(row + ": " + date);
      sheet.getRange(row, col).setValue(date);
    }
  }
}

function addFromPlaylist() {
  var videoIds = "MNyYhGgyB0U,vqG5YA3Fd_Q,u78LL9DCF5c,wbBgH93t4Mg,raQ6Qinn07A,W9lthQDpWMc,hNhG9soIZIM,fp2rFM69pwg,S-ZIIUdYITU,BS4YElLMmSM,eVsD-MMZufU,S1gFTrNygiY,SPVIiT3HZoU,aXgBbI1nLPo,T1mdcNlic48,wlzeh5ori8I,6QU17482mwc,JVjLxHRZMi4,KW_-5pd8frM,uIElPRAd3eQ,X_CihkAPitw,RliJTwOeHeY,uGmBXl90Z7c,uqaTFnsBM_0,K8TuwNzSS4o,Apu2sI91FCs,uLIP2_M39fE";
  videoIds = videoIds.split(",");

  var videoIdsToAdd = [];
  /*
  //var playlistId = "PLjZnYsmznVrZ9-alkdj4V4YI8hukI1TN4";
  var playlistId = "PLL0CQjrcN8D2mGf16oyQOJUmY1GOSy2na";
  var nextPageToken = "";

  while (nextPageToken != null) {
    var playlistResponse = YouTube.PlaylistItems.list('snippet', {playlistId: playlistId, maxResults: 10, pageToken: nextPageToken});

    for (var j = 0; j < playlistResponse.items.length; j++) {
      var videoId = playlistResponse.items[j].snippet.resourceId.videoId;

      //if (videoId == "xJF6JNwbQ4M")
        //break;

      videoIds.push(videoId);
    }

    //if (videoId == "xJF6JNwbQ4M")
      //break;

    nextPageToken = playlistResponse.nextPageToken;
  }
  */

  Logger.log(videoIds.length);
  Logger.log(videoIds);

  var channel = "SiIvaGunner";
  var channelSheet = spreadsheet.getSheetByName(channel);
  var ids = channelSheet.getRange(2, 1, channelSheet.getLastRow()).getValues();

  for (var i in videoIds) {
    videoIds[i] = videoIds[i].trim();
    var index = ids.findIndex(ids => {return ids[0] == videoIds[i]});

    if (index != -1) {
      var row = index + 2;
      Logger.log("Duplicate found on row " + row + ": " + videoIds[i]);
      //channelSheet.getRange(row, videoStatusCol).setValue("Unlisted")
    }
    else
      videoIdsToAdd.push(videoIds[i]);
  }

  Logger.log(videoIdsToAdd.length);
  Logger.log(videoIdsToAdd);

  addRipsToSheet(videoIdsToAdd, channel);
  addRipsToDatabase(videoIdsToAdd, channel);
}

function update() {
  var sheet = spreadsheet.getSheetByName("Flustered Fernando");

  var idCol = 1;
  var titleCol = 2;
  var wikiStatusCol = 3;
  var videoStatusCol = 4;
  var videoUploadDateCol = 5;
  var videoLengthCol = 6;
  var videoDescriptionCol = 7;
  var videoViewsCol = 8;
  var videoLikesCol = 9;
  var videoDislikesCol = 10;
  var videoCommentsCol = 11;

  var lastRow = sheet.getLastRow();

  var ids = sheet.getRange(2, idCol, lastRow - 1).getValues();
  var titles = sheet.getRange(2, titleCol, lastRow - 1).getValues();
  var wikiStatuses = sheet.getRange(2, wikiStatusCol, lastRow - 1).getValues();
  var videoStatuses = sheet.getRange(2, 1, lastRow - 1).getValues();
  var videoUploadDates = sheet.getRange(2, videoUploadDateCol, lastRow - 1).getValues();
  var videoLengths = sheet.getRange(2, videoLengthCol, lastRow - 1).getValues();
  var videoDescriptions = sheet.getRange(2, videoDescriptionCol, lastRow - 1).getValues();

  for (var i in titles) {
    var row = parseInt(i) + 2;

    var id = ids[i][0];
    var title = titles[i][0];
    var wikiStatus = wikiStatuses[i][0];
    var videoStatus = videoStatuses[i][0];
    var videoUploadDate = videoUploadDates[i][0];
    var videoLength = videoLengths[i][0];
    var videoDescription = videoDescriptions[i][0];

    Logger.log(formatLength(videoLength));
    //sheet.getRange(row, videoUploadDateCol).setValue(formatLength(videoLength));
  }
}

function statustest() {
  var channelSheet = spreadsheet.getSheetByName("Flustered Fernando");
  var row = 59;

  var videoId = channelSheet.getRange(row, idCol).getValue();

  //var ignoreList = ["Kj63e2Divew"];
  var index = -1;//ignoreList.findIndex(id => {return id == videoId});

  if (index != -1 || videoId == "Unknown")
    return;

  var title = channelSheet.getRange(row, titleCol).getValue();
  var currentStatus = channelSheet.getRange(row, videoStatusCol).getValue();
  var url = "https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=" + videoId + "&format=json";
  Logger.log(url);

  do {
    try {
      var responseCode = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getResponseCode();
    }
    catch (e) {
      var responseCode = null;
    }
  }
  while (responseCode == null)

  Logger.log("Row " + row + ": " + title + " (" + responseCode + ")");

  switch(responseCode) {
    case 200:
      Logger.log("Public");
      break;
    case 401:
    case 403:
      Logger.log("Private");
      break;
    case 404:
      Logger.log("Deleted");
      break;
    case 429:
    case 500:
    case 503:
    case 504:
      Utilities.sleep(1000);
      break;
    default:
      errorLog.push("Response code " + responseCode + "\n[" + title + "]\n[" + url + "]");
  }
}


function temp() {
  var sheet = spreadsheet.getSheetByName("SiIvaGunner");

  var idCol = 1;
  var titleCol = 2;
  var wikiStatusCol = 3;
  var videoStatusCol = 4;
  var videoUploadDateCol = 5;
  var videoLengthCol = 6;
  var videoDescriptionCol = 7;
  var videoViewsCol = 8;
  var videoLikesCol = 9;
  var videoDislikesCol = 10;
  var videoCommentsCol = 11;

  var lastRow = sheet.getLastRow();

  var ids = sheet.getRange(2, idCol, lastRow - 1).getValues();
  var titles = sheet.getRange(2, titleCol, lastRow - 1).getValues();
  var wikiStatuses = sheet.getRange(2, wikiStatusCol, lastRow - 1).getValues();
  var videoStatuses = sheet.getRange(2, 1, lastRow - 1).getValues();
  var videoUploadDates = sheet.getRange(2, videoUploadDateCol, lastRow - 1).getValues();
  var videoLengths = sheet.getRange(2, videoLengthCol, lastRow - 1).getValues();
  var videoDescriptions = sheet.getRange(2, videoDescriptionCol, lastRow - 1).getValues();

  var testSheet = SpreadsheetApp.openById("11XxOGk3IVJdiOs3nFzcdFxhedXep4_JLRSXTs8E-2v8");
  var unmatchedSheet = testSheet.getSheetByName("Unmatched");
  var testIds = unmatchedSheet.getRange(1, 1, 41).getValues();
  var missingSheet = testSheet.getSheetByName("Reddit");
  var missingIds = missingSheet.getRange(1, 1, missingSheet.getLastRow()).getValues();
  var missingTitles = missingSheet.getRange(1, 2, missingSheet.getLastRow()).getValues();
  var missingDates = missingSheet.getRange(1, 3, missingSheet.getLastRow()).getValues();
  var missingStatuses = missingSheet.getRange(1, 4, missingSheet.getLastRow()).getValues();
  var newRow = 0;

  //Logger.log(missingTitles);
  //Logger.log(titles);

  for (var i in missingIds) {
    var row = parseInt(i) + 1;

    var id = ids[i][0];
    var title = titles[i][0];
    var wikiStatus = wikiStatuses[i][0];
    var videoStatus = videoStatuses[i][0];
    var videoUploadDate = videoUploadDates[i][0];
    var videoLength = videoLengths[i][0];
    var videoDescription = videoDescriptions[i][0];

    //var testId = testIds[i][0];
    var missingId = missingIds[i][0];
    var missingTitle = missingTitles[i][0];
    var missingDate = missingDates[i][0];
    var missingStatus = missingStatuses[i][0];

    //missingSheet.getRange(row, 1).setValue(formatYouTubeHyperlink(missingId));
    //missingSheet.getRange(row, 2).setValue(formatWikiHyperlink(missingTitle));

    /*
    var url = "https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=" + missingId + "&format=json";
    //var url = "https://siivagunner.fandom.com/wiki/" + missingTitle;

    do {
      try {
        var responseCode = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getResponseCode();
      }
      catch (e) {
        var responseCode = null;
      }
    }
    while (responseCode == null)

    switch(responseCode) {
      case 200:
        Logger.log(missingId + ": public on row " + row);
        missingSheet.getRange(row, 3).setValue("Public");
        break;
      case 403:
        Logger.log(missingId + ": private on row " + row);
        missingSheet.getRange(row, 3).setValue("Private");
        break;
      case 404:
        Logger.log(missingId + ": deleted on row " + row);
        missingSheet.getRange(row, 3).setValue("Deleted");
        break;
    }
    //*/

    /*
    var index = ids.findIndex(ids => {return ids[0] == missingId});

    if (index == -1) {
      Logger.log("Missing: " + missingId);
    }
    else {
      var row = index + 2;
      Logger.log("Found " + missingId + " on row " + row);
      //sheet.getRange(newRow, idCol).setValue(formatYouTubeHyperlink(missingId));
      //sheet.getRange(newRow, videoUploadDateCol).setValue(missingDate);
    }
    //*/

    /*
    if (missingStatus == "Public") {
      do {
        try {
          var videoResponse = YouTube.Videos.list('snippet,contentDetails,statistics',{id: missingId, maxResults: 1, type: 'video'});
          var e = "";
        }
        catch (e) {}
      }
      while (e != "")

      videoResponse.items.forEach(function(item) {
                                    var uploadDate = formatDate(item.snippet.publishedAt);
                                    var length = item.contentDetails.duration.toString();
                                    var description = item.snippet.description.toString().replace(/\r/g, "").replace(/\n/g, "NEWLINE");

                                    Logger.log(missingTitle + "\n" + uploadDate + "\n" + length + "\n" + description.replace(/\n/g, "NEWLINE"));
                                  });
    }
    //*/
  }
}

function runthis() {
  var videoIdsToAdd = ["500KCNt8hNI"];
  addVideosById(videoIdsToAdd, "TimmyTurnersGrandDad");
}

function statuscheck() {
  var id = "YskxwYFW7eE";
  var errorLog = [];
  var changeLog = [];
  var currentStatus = "";
  var row = 0;
  var newStatus = "None";
  var url = "https://www.youtube.com/watch?v=" + id;

  do {
    try {
      var responseText = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText();
    }
    catch (e) {
      var responseText = null;
    }
  }
  while (responseText == null)

  if (responseText.indexOf('"isUnlisted":true') != -1) {
    if (currentStatus != "Unlisted")
      newStatus = "Unlisted";
  }
  else if (responseText.indexOf('"status":"OK"') != -1) {
    if (currentStatus != "Public")
      newStatus = "Public";
  }
  else if (responseText.indexOf('"This video is private."') != -1) {
    if (currentStatus != "Private")
      newStatus = "Private";
  }
  else if (responseText.indexOf('"status":"ERROR"') != -1) {
    if (currentStatus != "Deleted")
      newStatus = "Deleted";
  }
  else if (responseText.indexOf('"status":"UNPLAYABLE"') != -1) {
    if (currentStatus != "Unavailable")
      newStatus = "Unavailable";
  }
  else {
    Logger.log(title + " video status not found.");
    errorLog.push(title + " video status not found. [view-source:" + url + "]");
  }

  Logger.log("Row " + row + ": " + title + " (" + newStatus + ")");

  if (newStatus != "None") {
    channelSheet.getRange(row, videoStatusCol).setValue(newStatus);
    errorLog.push(title + " was changed from " + currentStatus + " to " + newStatus + ".");
    changelog.push(["Statuses", formatYouTubeHyperlink(videoId), formatWikiHyperlink(title, wikiUrl), currentStatus, newStatus]);
  }
}


function insert() {
  var sheet = spreadsheet.getSheetByName("SiIvaGunner");

  var idCol = 1;
  var titleCol = 2;
  var wikiStatusCol = 3;
  var videoStatusCol = 4;
  var videoUploadDateCol = 5;
  var videoLengthCol = 6;
  var videoDescriptionCol = 7;
  var videoViewsCol = 8;
  var videoLikesCol = 9;
  var videoDislikesCol = 10;
  var videoCommentsCol = 11;

  var lastRow = sheet.getLastRow();
  var start = 2;
  var end = 3;

  var ids = sheet.getRange(2, idCol, end).getValues();
  var titles = sheet.getRange(2, titleCol, end).getValues();
  var wikiStatuses = sheet.getRange(2, wikiStatusCol, end).getValues();
  var videoStatuses = sheet.getRange(2, videoStatusCol, end).getValues();
  var videoUploadDates = sheet.getRange(2, videoUploadDateCol, end).getValues();
  var videoLengths = sheet.getRange(2, videoLengthCol, end).getValues();
  var videoDescriptions = sheet.getRange(2, videoDescriptionCol, end).getValues();
  var videoViews = sheet.getRange(2, videoViewsCol, end).getValues();
  var videoLikes = sheet.getRange(2, videoLikesCol, end).getValues();
  var videoDislikes = sheet.getRange(2, videoDislikesCol, end).getValues();
  var videoComments = sheet.getRange(2, videoCommentsCol, end).getValues();

  var insert = "INSERT INTO Rips_rip VALUES ( ";

  for (var row = start; row <= end; row++) {
    var i = row - 1;
    var id = ids[i][0];
    var title = titles[i][0];
    var wikiStatus = wikiStatuses[i][0];
    var videoStatus = videoStatuses[i][0];
    var videoUploadDate = videoUploadDates[i][0];
    var videoLength = videoLengths[i][0];
    var videoDescription = videoDescriptions[i][0];
    var videoViewCount = videoViews[i][0];
    var videoLikeCount = videoLikes[i][0];
    var videoDislikeCount = videoDislikes[i][0];
    var videoCommentCount = videoComments[i][0];

    var slug = id;

    var channel = "SiIvaGunner";
    var author = "spreadsheet-bot";
    var visible = "True";

    videoUploadDate = Utilities.formatDate(videoUploadDate, "UTC", "yyyy-MM-dd HH:mm:ss");

    insert += "('" + id + "', '" + title.replace(/'/g, "''") + "', '" + id + "', '" + wikiStatus + "', '" + videoStatus + "', '" +
                      videoUploadDate + "', '" + videoDescription + "', '" + videoLength + "', '" + videoViewCount + "', '" + videoLikeCount + "', '" +
                      videoDislikeCount + "', '" + videoCommentCount + "', 'spreadsheet-bot', '" + channel + "', TRUE ), ";
  }

  insert += ");"
  insert = insert.replace("), );", " );");

  Logger.log(insert);
}
