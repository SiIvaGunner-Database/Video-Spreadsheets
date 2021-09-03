function checkChannels()
{
  var startTime = new Date();
  
  var playlistSpreadsheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  var playlistSheet = playlistSpreadsheet.getSheetByName("Channels");
  var changelogSheet = playlistSpreadsheet.getSheetByName("Changelog");
  
  var formSpreadsheet = SpreadsheetApp.openById("1rKis0NkF_v5YLzveQ1e1MQMbDgjTpRUPkIdk-6PB12Q");
  var formSheet = formSpreadsheet.getSheetByName("Contributor Playlists");
  var row = formSheet.getLastRow();
  
  do
  {
    var status = formSheet.getRange(row, 3).getValue();
    
    if (status == "")
    {
      var newPlaylists = formSheet.getRange(row, 2).getValue().replace(/ /g, "").split(",");
      
      for (var i in newPlaylists)
      {
        newPlaylists[i] = newPlaylists[i].replace("&feature=youtu.be", "").replace(/h.*list=/, "").replace(/\(.*/, "").trim();

        var playlistId = newPlaylists[i];
        var playlistIds = playlistSheet.getRange(2, 1, playlistSheet.getLastRow() - 1).getValues();
        var index = playlistIds.findIndex(id => {return id == playlistId});

        var emailAddress = "a.k.zamboni@gmail.com";
        var subject = "SiIvaGunner Contributor Playlists Update";
        var message = "New ID: " + playlistId + " [" + playlistId.length + "]";
        
        Logger.log(message);
        MailApp.sendEmail(emailAddress, subject, message);

        if (index != -1)
        {
          formSheet.getRange(row, 3).setValue("Failed");
          Logger.log("Duplicate playlist ID: " + playlistId);
          errorlog.push("Duplicate playlist ID: " + playlistId);
        }
        else
        {
          var playlistDetails = getPlaylistDetails(playlistId, true);
          
          playlistSheet.insertRowBefore(2);
          playlistSheet.getRange(2, 1).setValue(playlistDetails[0]);
          playlistSheet.getRange(2, 2).setValue(playlistDetails[1]);
          playlistSheet.getRange(2, 3).setValue(playlistDetails[2]);
          playlistSheet.getRange(2, 4).setValue(playlistDetails[3].toString().replace(/,/g, ", "));
          playlistSheet.getRange(2, 5).setValue(playlistDetails[4]);
          playlistSheet.getRange(2, 6).setValue(playlistDetails[5].toString().replace(/,/g, ", "));
          playlistSheet.getRange(2, 7).setValue(playlistDetails[6]);
          playlistSheet.getRange(2, 8).setValue(formatDate(new Date()));
          playlistSheet.getRange(2, 1, playlistSheet.getLastRow() - 1, playlistSheet.getLastColumn()).sort({column: 3, ascending: true});
          formSheet.getRange(row, 3).setValue("Checked");
        }
      }
    }
  }
  while (--row > 1 && status == "")
  
  row = 2;
  var lastRow = playlistSheet.getLastRow();
  
  do
  {
    var changelog = [];
    var playlistDetails = [];

    var playlistId = playlistSheet.getRange(row, 1).getValue();
    var playlistTitle = playlistSheet.getRange(row, 2).getValue();
    var contributor = playlistSheet.getRange(row, 3).getFormula();
    var videoIds = playlistSheet.getRange(row, 6).getValue().toString().split(", ");
    var status = playlistSheet.getRange(row, 7).getValue();

    var url = "https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=" + playlistId + "&format=json";
    
    do
    {
      try
      {
        var responseCode = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getResponseCode();
      }
      catch (e)
      {
        Logger.log(e);
        Utilities.sleep(10000);
        var responseCode = null;
      }
    }
    while (responseCode == null)
    
    Logger.log("Row " + row + ": " + playlistTitle + " (" + responseCode + ")");

    switch(responseCode)
    {
      case 200:
        if (status != "Public" && status != "Unlisted")
        {
          playlistSheet.getRange(row, 7).setValue("Public");
          changelog.push("The playlist has been made public.");
          status = "Public";
        }
        break;
      case 401:
        break;
      case 403:
        if (status != "Private")
        {
          playlistSheet.getRange(row, 7).setValue("Private");
          changelog.push("The playlist has been made private.");
          status = "Private";
        }
        break;
      case 404:
        if (status != "Deleted")
        {
          playlistSheet.getRange(row, 7).setValue("Deleted");
          changelog.push("The playlist has been deleted.");
          status = "Deleted";
        }
        break;
      default:
        errorlog.push("Response code " + responseCode + "\n[" + playlistTitle + "]\n[" + url + "]");
    }
    
    if (status == "Public" || status == "Unlisted")
    {
      var channel = playlistSheet.getRange(row, 4).getValue();
      
      if (channel == "Ignore")
        playlistDetails = getPlaylistDetails(playlistId, true);
      else
        playlistDetails = getPlaylistDetails(playlistId, false);

      if (playlistDetails[1] != playlistTitle)
      {
        Logger.log("Setting playlist title " + playlistDetails[1]);
        changelog.push("Old playlist title: " + playlistTitle + "\nNew playlist title: " + playlistDetails[1]);
        playlistSheet.getRange(row, 2).setValue(playlistDetails[1]);
      }
      
      if (playlistDetails[2] != contributor)
      {
        Logger.log("Setting contributor " + playlistDetails[2]);
        changelog.push("Old contributor name: " + contributor.replace(/.*", "/g, "").replace("\")", "") + 
                       "\nNew contributor name: " + playlistDetails[2].replace(/.*", "/g, "").replace("\")", ""));
        playlistSheet.getRange(row, 3).setValue(playlistDetails[2]);
      }
      
      if (playlistDetails[5].toString() != videoIds.toString())
      {
        Logger.log(videoIds);
        Logger.log(playlistDetails[5]);
        
        for (var k in playlistDetails[5])
        {
          var index = videoIds.findIndex(id => {return id == playlistDetails[5][k]});
          
          if (index == -1)
            changelog.push(formatHyperlink("Added " + playlistDetails[5][k], "https://www.youtube.com/watch?v=" + playlistDetails[5][k]));
        }

        for (var k in videoIds)
        {
          var index = playlistDetails[5].findIndex(id => {return id == videoIds[k]});
          
          if (index == -1)
            changelog.push(formatHyperlink("Removed " + videoIds[k], "https://www.youtube.com/watch?v=" + videoIds[k]));
        }

        if (playlistDetails[3] != "Ignore")
          playlistSheet.getRange(row, 4).setValue(playlistDetails[3].toString().replace(/,/g, ", "));
        
        playlistSheet.getRange(row, 5).setValue(playlistDetails[4]);
        playlistSheet.getRange(row, 6).setValue(playlistDetails[5].toString().replace(/,/g, ", "));
      }
    }
    else
    {
      playlistDetails[0] = formatHyperlink(playlistId, "https://www.youtube.com/playlist?list=" + playlistId);
      playlistDetails[1] = playlistTitle;
      playlistDetails[2] = contributor;
    }

    if (changelog.length > 0)
    {
      for (var i in changelog)
      {
        changelogSheet.insertRowBefore(2);
        changelogSheet.getRange(2, 1).setValue(playlistDetails[0]);
        changelogSheet.getRange(2, 2).setValue(playlistDetails[1]);
        changelogSheet.getRange(2, 3).setValue(changelog[i]);
        changelogSheet.getRange(2, 4).setValue(playlistDetails[2]);

        if (changelog[i].indexOf("Added") != -1 || changelog[i].indexOf("Removed") != -1)
        {
          try
          {
            var videoId = changelog[i].replace(/.*v=/g, "").replace(/".*/g, "");
            var videoResponse = YouTube.Videos.list("snippet",{id: videoId, maxResults: 1, type: 'video'});
            
            var video = videoResponse.items[0].snippet;
            var channel = video.channelTitle;
            
            changelogSheet.getRange(2, 5).setValue(channel)
          }
          catch (e) 
          {
            errorlog.push(videoId + "\n" + e);
            changelogSheet.getRange(2, 5).setValue("Unknown")
          }
        }
        else changelogSheet.getRange(2, 5).setValue("n/a");

        var logDate = formatDate(new Date());
        changelogSheet.getRange(2, 6).setValue(logDate);
        playlistSheet.getRange(row, 8).setValue(logDate);
      }
    }

    var currentTime = new Date();
  }
  while (++row <= lastRow && currentTime.getTime() - startTime.getTime() < 300000) // Run for 5 minutes.
  
  if (errorlog.length > 0 || changelog.length > 0)
  {
    // Send an email notifying of any changes or errors.
    var emailAddress = "a.k.zamboni@gmail.com";
    var subject = "SiIvaGunner Contributor Playlists Update";
    var changeCount = errorlog.length + changelog.length;
    var message = "[https://docs.google.com/spreadsheets/d/13UJWz8wWSVADkMW_lW8nkQFcez6T7xuDw3_IrMuez2g/edit#gid=1039083277]\nThere are " + changeCount + " updates.\n\n" + errorlog.join("\n\n") + changelog.join("\n\n");
    
    MailApp.sendEmail(emailAddress, subject, message);
    Logger.log("Email successfully sent.\n" + message);
  }
}

function getPlaylistDetails(playlistId, getChannels)
{
  var status = "Public";
  var channels = [];
  var videoIds = [];
  var nextPageToken = "";
  
  try
  {
    var playlistResponse = YouTube.Playlists.list("snippet", {id: playlistId});
  }
  catch(e)
  {
    errorlog.push(playlistId + "\n" + e);
    Logger.log(playlistId + "\n" + e);
  }
  
  var playlist = playlistResponse.items[0].snippet;
  var playlistTitle = playlist.title;
  var contributor = playlist.channelTitle;
  var contributorId = playlist.channelId;
  
  while (nextPageToken != null)
  {
    try
    {
      var playlistItemsResponse = YouTube.PlaylistItems.list("snippet", {playlistId: playlistId, maxResults: 50, pageToken: nextPageToken});
    }
    catch(e)
    {
      errorlog.push(playlistId + "\n" + e);
      Logger.log(playlistId + "\n" + e);
    }
    
    for (var i = 0; i < playlistItemsResponse.items.length; i++)
    {
      var videoId = playlistItemsResponse.items[i].snippet.resourceId.videoId;
      videoIds.push(videoId);
      
      if (getChannels)
      {
        try
        {
          var videoResponse = YouTube.Videos.list("snippet",{id: videoId, maxResults: 1, type: 'video'});
          
          var video = videoResponse.items[0].snippet;
          var channel = video.channelTitle;
          var channelId = video.channelId;
          
          var index = channels.findIndex(title => {return title == channel});
          
          if (index == -1)
            channels.push(channel);
        }
        catch (e) {}
      }
      else channels = "Ignore";
    }
    
    var videoCount = playlistItemsResponse.pageInfo.totalResults;
    nextPageToken = playlistItemsResponse.nextPageToken;
  }
  
  return [
    formatHyperlink(playlistId, "https://www.youtube.com/playlist?list=" + playlistId), 
    playlistTitle,
    formatHyperlink(contributor, "https://www.youtube.com/channel/" + contributorId),
    channels,
    videoCount,
    videoIds,
    status
  ];
}

function formatDate(date)
{
  if (typeof date == "string")
    date = date.replace("T", "   ").replace("Z", "").replace(".000Z", "");
  else 
    date = Utilities.formatDate(date, "UTC", "yyyy-MM-dd   HH:mm:ss");
  
  return date;
}

function formatHyperlink(title, url)
{
  var str = '=HYPERLINK("' + url + '", "' + title + '")';
  return str;
}

function checkPlaylistsTrigger()
{
  ScriptApp.newTrigger("checkAllPlaylists")
  .timeBased()
  .everyHours(1)
  .create();
}
