function temp() {
  const ids = ["YIKSlE9got0", "NG75Kd2tc24", "VQFLIL3NrKw", "xXwOuC7hx7s",
      "s8aPh_ZuK14", "Ff_A8bvnkSk", "C4WSmmCq34o", "iMUWUqNNeQw", "Z14NG4s5H28",
      "iuFPrSjzvbA", "szOslgXrtPQ", "Nz8Jb_OUeXI"];
  const channel = "VvvvvaVvvvvvr";
  const dbId = 2;
  // addRipsToSheet(ids, channel);
  addRipsToDatabase(ids, channel, dbId);
}

function testfetch() {
  const url = "https://siivagunner.fandom.com/wiki/Epic_-_Kingdom_Hearts_Re:Chain_Of_Memories";
  const fetch = UrlFetchApp.fetch(url, {'followRedirects':false});
  const code = fetch.getResponseCode();
  const content = fetch.getContentText();
  Logger.log(code);
  Logger.log(content);
}

// Global variables used in the project

var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

var emailAddress = "a.k.zamboni@gmail.com";

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

var lastUpdatedRowCol = 5;
var lastUpdatedTimeCol = 6;

var channelsObject = {};

var errorlog = [];


function checkThePublicVideos() {
  var channels = [["Mysikt", "UCnv4xkWtbqAKMj8TItM6kOA", null]];  
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  for (var i in channels) {
    var channelTitle = channels[i][0];
    var channelId = channels[i][1];
    var channelDatabaseId = channels[i][2];
    
    Logger.log("Working on " + channelTitle);
    
    var channelSheet = spreadsheet.getSheetByName(channelTitle);
    var channelVideoIds = [];
    var missingVideoIds = [];
    var sheetVideoIds = channelSheet.getRange(2, idCol, channelSheet.getLastRow() - 1).getDisplayValues();
    var channelResponse = YouTube.Channels.list('contentDetails', {id: channelId});
    
    for (var i in channelResponse.items) {
      var item = channelResponse.items[i];
      var uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
      var nextPageToken = "";
      
      while (nextPageToken != null) {
        var playlistResponse = YouTube.PlaylistItems.list('snippet', {playlistId: uploadsPlaylistId, maxResults: 50, pageToken: nextPageToken});
        
        for (var k = 0; k < playlistResponse.items.length; k++)
          channelVideoIds.push(playlistResponse.items[k].snippet.resourceId.videoId);
        
        nextPageToken = playlistResponse.nextPageToken;
      }
    }
    
    Logger.log("Sheet IDs: " + sheetVideoIds.length);
    Logger.log("Video IDs: " + channelVideoIds.length);
    
    for (var k in channelVideoIds) {
      var index = sheetVideoIds.findIndex(ids => {return ids[0] == channelVideoIds[k]});
      
      if (index == -1)
        missingVideoIds.push(channelVideoIds[k]);
    }
    
    for (var k in missingVideoIds)
      Logger.log("Missing from spreadsheet: " + missingVideoIds[k]);
    
    // Add missing videos to the corresponding sheet and database table
    addRipsToSheet(missingVideoIds, channelTitle);

    if (channelDatabaseId != null && missingVideoIds.length > 0) {
      var subject = "SiIvaGunner Spreadsheet Missing IDs";
      var message = "Missing from spreadsheet: " + missingVideoIds.join(", ");
      
      MailApp.sendEmail(emailAddress, subject, message);
      Logger.log("Email successfully sent.");

      //addRipsToDatabase(missingVideoIds, channelTitle, channelDatabaseId);
    }
  }
}












function addRipsToSheet(videoIds, channel) {
  if (!channel)
    channel = "SiIvaGunner";

  var logging = false; // Log the operations when true
  var building = true; // Add to sheet when true
  var channelSheet = spreadsheet.getSheetByName(channel);
  var lastRow = channelSheet.getLastRow();
  
  if (channel == "TimmyTurnersGrandDad")
    var wikiUrl = "https://ttgd.fandom.com/wiki/";
  else if (channel == "VvvvvaVvvvvvr")
    var wikiUrl = "https://vvvvvavvvvvr.fandom.com/wiki/";
  else if (channel == "Flustered Fernando")
    var wikiUrl = "https://flustered-fernando.fandom.com/wiki/";
  else if (channel = "Mysikt")
    var wikiUrl = "https://mysikt.fandom.com/wiki/";
  else
    var wikiUrl = "https://siivagunner.fandom.com/wiki/";
  
  for (var i in videoIds) {
    do {
      try {
        var videoResponse = YouTube.Videos.list('snippet,contentDetails,statistics',{id: videoIds[i], maxResults: 1, type: 'video'});
        var e = "";
      }
      catch (e) {}
    }
    while (e != "")
  
    var item = videoResponse.items[0];
    var channelId = item.snippet.channelId;
    var videoHyperlink = formatYouTubeHyperlink(videoIds[i]);
    var wikiHyperlink = formatWikiHyperlink(item.snippet.title, wikiUrl);
    var uploadDate = formatDate(item.snippet.publishedAt);
    var length = item.contentDetails.duration.toString();
    var description = item.snippet.description.toString().replace(/\r/g, "").replace(/\n/g, "NEWLINE");
    var viewCount = item.statistics.viewCount;
    var likeCount = item.statistics.likeCount;
    var dislikeCount = item.statistics.dislikeCount;
    var commentCount = item.statistics.commentCount;
    
    if (!commentCount)
      commentCount = 0;
    
    if (logging) {
      Logger.log(channelId);
      Logger.log(videoHyperlink);
      Logger.log(wikiHyperlink);
      Logger.log(uploadDate);
      Logger.log(length);
      Logger.log(description);
      Logger.log(viewCount);
      Logger.log(likeCount);
      Logger.log(dislikeCount);
      Logger.log(commentCount);
    }
    
    if (building) {
      channelSheet.insertRowAfter(lastRow);
      lastRow++;
      
      channelSheet.getRange(lastRow, idCol).setFormula(videoHyperlink);
      channelSheet.getRange(lastRow, titleCol).setFormula(wikiHyperlink);
      channelSheet.getRange(lastRow, wikiStatusCol).setValue("Undocumented");
      channelSheet.getRange(lastRow, videoStatusCol).setValue("Public");
      channelSheet.getRange(lastRow, videoUploadDateCol).setValue(uploadDate);
      channelSheet.getRange(lastRow, videoLengthCol).setValue(length);
      channelSheet.getRange(lastRow, videoDescriptionCol).setValue(description);
      channelSheet.getRange(lastRow, videoViewsCol).setValue(viewCount);
      channelSheet.getRange(lastRow, videoLikesCol).setValue(likeCount);
      if (dislikeCount) {
        channelSheet.getRange(lastRow, videoDislikesCol).setValue(dislikeCount);
      }
      channelSheet.getRange(lastRow, videoCommentsCol).setValue(commentCount);
      
      Logger.log("Added " + item.snippet.title + " to " + channel);
    }
  }
}

// Format a date for the spreadsheet
function formatDate(date, style) {
  if (typeof date == "string")
    date = date.replace("T", "   ").replace("Z", "").replace(".000Z", "");
  else 
    date = Utilities.formatDate(date, "UTC", "yyyy-MM-dd   HH:mm:ss");
  
  return date;
}



// Format to a more easily readable string (WIP)
function formatLength(length) {
  for (var i = 0; i < length.length; i++) {
    if (length.charAt(i) == "T" && length.charAt(i + 2) == "S")
      length = length.replace("PT", "0:0");
    else if (length.charAt(i) == "T" && length.charAt(i + 3) == "S")
      length = length.replace("PT", "0:");
    else if (length.charAt(i) == "M" && length.charAt(i + 2) == "S")
      length = length.replace("M", ":0");
    if (length.charAt(i) == "H" && length.charAt(i + 2) == "M")
      length = length.replace("H", ":0");
  }
  
  if (length.indexOf("S") == -1)
    length += "00";
  
  length = length.replace("PT", "").replace("H", ":").replace("M", ":").replace("S", "");
  
  return length;
}



// Formats a YouTube hyperlink function for the spreadsheet
function formatYouTubeHyperlink(str) {
  str = '=HYPERLINK("https://www.youtube.com/watch?v=' + str + '", "' + str + '")';
  return str;
}



// Formats a wiki hyperlink function for the spreadsheet
function formatWikiHyperlink(str, wikiUrl) {
  if (wikiUrl == null)
    wikiUrl = "https://siivagunner.fandom.com/wiki/";
  
  str = str.replace(/Reupload: /g, "").replace(/Reup: /g, "");
  var simpleStr = str.replace(/"/g, '""').replace(/ \(GiIvaSunner\)/g, "");
  
  str = '=HYPERLINK("' + wikiUrl + formatWikiLink(str) + '", "' + simpleStr + '")';
  return str;
}



// Replaces bad url characters and banned words
function formatWikiLink(str) {
  str = str.replace(/\[/g, '(');
  str = str.replace(/\]/g, ')');
  str = str.replace(/\{/g, '(');
  str = str.replace(/\}/g, ')');
  str = str.replace(/#/g, '');
  str = str.replace(/\​\|\​_/g, 'L');
  str = str.replace(/\|/g, '');
  str = str.replace(/Nigga/g, 'N----');
  return encodeURIComponent(str);
}
