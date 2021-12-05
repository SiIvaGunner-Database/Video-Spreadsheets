/**
 * Checks for newly uploaded rips.
 */
function checkRecentVideos() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    if (channel.youtubeStatus != "Public") {
      Logger.log("Skipping " + channel.name + "; current status is " + channel.youtubeStatus);
      return;
    }

    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const sheetIds = sheetVideos.map(video => video.id);
    const recentVideos = HighQualityUtils.getChannelUploads(channel.id, 50);
    const newVideos = [];

    // Find any new videos
    recentVideos.forEach((recentVideo) => {
      if (!sheetIds.includes(recentVideo.id)) {
        newVideos.push(recentVideo);
        Logger.log("New video: " + recentVideo.title);
      }
    });

    // Add any new videos to the sheet and database
    if (newVideos) {
      HighQualityUtils.addToSheet(videoSheet, newVideos);
      HighQualityUtils.getDatabaseResponse("rips", "post", newVideos);
      Logger.log("Added " + newVideos.length + " new videos");
    } else {
      Logger.log("No new videos found");
    }
  });
}

/**
 * Checks for consistency with the video database.
 */
function checkVideoDatabase() {
  const allDbVideos = HighQualityUtils.getDatabaseResponse("rips");
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    if (channel.youtubeStatus != "Public") {
      Logger.log("Skipping " + channel.name + "; current status is " + channel.youtubeStatus);
      return;
    }

    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const dbVideos = allDbVideos.filter(dbVideo => dbVideo.channel == channel.id);
    const dbIds = dbVideos.map(video => video.id);
    const missingVideos = [];

    // Find any videos missing from the database
    if (sheetVideos.length > dbVideos.length) {
      sheetVideos.forEach((sheetVideo) => {
        if (!dbIds.includes(sheetVideo.id)) {
          missingVideos.push(sheetVideo);
          Logger.log("Missing video: " + sheetVideo.title);
        }
      });
    }

    // Add any missing videos to the database
    if (missingVideos) {
      HighQualityUtils.getDatabaseResponse("rips", "post", missingVideos);
      Logger.log("Added " + missingVideos.length + " missing videos");
    } else {
      Logger.log("No missing videos found");
    }

    // Update all data in the database
    HighQualityUtils.getDatabaseResponse("rips", "put", sheetVideos);
    Logger.log("Updated video database");
  });
}

/**
 * Checks for video details and statistics updates.
 */
function checkVideoDetails() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const titleChangelogSheet = SpreadsheetApp.openById("1EKQq1K8Bd7hDlFMg1Y5G_a2tWk_FH39bgniUUBGlFKM").getSheetByName("Titles");
  const descChangelogSheet = SpreadsheetApp.openById("1EKQq1K8Bd7hDlFMg1Y5G_a2tWk_FH39bgniUUBGlFKM").getSheetByName("Descriptions");
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    if (channel.youtubeStatus != "Public") {
      Logger.log("Skipping " + channel.name + "; current status is " + channel.youtubeStatus);
      return;
    }

    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const videoIds = sheetVideos.map(video => video.id);
    const ytVideos = HighQualityUtils.getVideos(videoIds);

    sheetVideos.forEach((sheetVideo, sheetIndex) => {
      Logger.log("Updating " + sheetVideo.title);
      const ytIndex = ytVideos.indexOf(ytVideo => ytVideo.id == sheetVideo.id);
      const ytVideo = ytVideos[ytIndex];

      if (!ytVideo) {
        Logger.log("Skipping row; no corresponding video found");
        return;
      }

      if (sheetVideo.title != ytVideo.title) {
        HighQualityUtils.logChange(titleChangelogSheet, sheetVideo.id, "Title", sheetVideo.title, ytVideo.title);
        sheetVideo.title = ytVideo.title;
        Logger.log("New title: " + sheetVideo.title);
      }

      if (sheetVideo.description != ytVideo.description) {
        HighQualityUtils.logChange(descChangelogSheet, sheetVideo.id, "Description", sheetVideo.description, ytVideo.description);
        sheetVideo.description = ytVideo.description;
        Logger.log("New description: " + sheetVideo.description);
      }

      // Update statistics
      sheetVideo.viewCount = ytVideo.viewCount;
      sheetVideo.likeCount = ytVideo.likeCount;
      sheetVideo.dislikeCount = ytVideo.dislikeCount;
      sheetVideo.commentCount = ytVideo.commentCount;

      // Set sheet hyperlinks
      sheetVideo.id = HighQualityUtils.formatYouTubeHyperlink(sheetVideo.id);
      sheetVideo.title = HighQualityUtils.formatFandomHyperlink(sheetVideo.title);
      sheetVideos[sheetIndex] = sheetVideo;
    });

    HighQualityUtils.updateInSheet(videoSheet, sheetVideos, 2)
  });
}

/**
 * Checks for video status changes.
 */
function checkVideoStatuses() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const statusChangelogSheet = SpreadsheetApp.openById("1EKQq1K8Bd7hDlFMg1Y5G_a2tWk_FH39bgniUUBGlFKM").getSheetByName("Statuses");
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    if (channel.youtubeStatus != "Public") {
      Logger.log("Skipping " + channel.name + "; current status is " + channel.youtubeStatus);
      return;
    }

    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const ytVideos = HighQualityUtils.getChannelUploads(channel.id);
    const extraYtVideos = ytVideos.slice();

    sheetVideos.forEach((sheetVideo, sheetIndex) => {
      Logger.log("Updating " + sheetVideo.title);
      const row = parseInt(sheetIndex) + 2;
      const ytIndex = extraYtVideos.indexOf(ytVideo => ytVideo.id == sheetVideo.id);
      const ytVideo = extraYtVideos[ytIndex];

      if (!ytVideo) {
        const currentStatus = HighQualityUtils.getYouTubeStatus(ytVideo.id);
        Logger.log("No corresponding video found; current status is " + currentStatus);

        if (sheetVideo.youtubeStatus != currentStatus) {
          HighQualityUtils.logChange(statusChangelogSheet, sheetVideo.id, "YouTube Status", sheetVideo.youtubeStatus, currentStatus);
          sheetVideo.youtubeStatus = currentStatus;
          HighQualityUtils.updateInSheet(videoSheet, sheetVideo, row);
          Logger.log("New status: " + sheetVideo.youtubeStatus);
        }
      } else  {
        extraYtVideos.splice(ytIndex, 1);

        if (sheetVideo.youtubeStatus != "Public") {
          HighQualityUtils.logChange(statusChangelogSheet, sheetVideo.id, "YouTube Status", sheetVideo.youtubeStatus, "Public");
          sheetVideo.youtubeStatus = "Public";
          HighQualityUtils.updateInSheet(videoSheet, sheetVideo, row);
          Logger.log("New status: Public");
        }
      }
    });

    if (extraYtVideos.length > 0) {
      const missingIds = extraYtVideos.map(video => video.id);
      const message = "Videos missing from " + channel.name + " sheet: " + missingIds.join(", ");
      Logger.log(message);
      HighQualityUtils.logEvent(message);
      HighQualityUtils.addToSheet(videoSheet, extraYtVideos);
      Logger.log("Added " + extraYtVideos.length + " missing videos");
    }
  });
}

/**
 * Checks for wiki status changes.
 */
function checkWikiStatuses() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    if (channel.youtubeStatus != "Public") {
      Logger.log("Skipping " + channel.name + "; current status is " + channel.youtubeStatus);
      return;
    }

    if (!channel.wiki) {
      Logger.log("Skipping " + channel.name + "; no corresponding wiki found");
      return;
    }

    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const undocumentedSheetVideos = sheetVideos.filter(video => video.wikiStatus == "Undocumented");
    let playlistId = "";

    // If the current channel is SiIvaGunner or TimmyTurnersGrandDad, update the Undocumented Rips playlist
    if (channel.id == "UC9ecwl3FTG66jIKA9JRDtmg" || channel.id == "UCIXM2qZRG9o4AFmEsKZUIvQ") {
      if (channel.id == "UC9ecwl3FTG66jIKA9JRDtmg") {
        playlistId = "PLn8P5M1uNQk4_1_eaMchQE5rBpaa064ni";
      } else if (channel.id == "UCIXM2qZRG9o4AFmEsKZUIvQ") {
        playlistId = "PLn8P5M1uNQk6B4aJfjJZX1gdzlaHpgRAm";
      }

      const undocumentedPlVideos = HighQualityUtils.getPlaylistItems(playlistId);
      const extraPlVideos = undocumentedPlVideos.slice();

      undocumentedSheetVideos.forEach((sheetVideo) => {
        const plIndex = extraPlVideos.indexOf(plVideo => plVideo.id == sheetVideo.id);

        if (plIndex == -1) {
          if (sheetVideo.youtubeStatus ==  "Public" || sheetVideo.youtubeStatus ==  "Unlisted") {
            HighQualityUtils.addToPlaylist(playlistId, sheetVideo.id);
            Logger.log("Added " + sheetVideo.title + " to playlist");
          }
        } else {
          extraPlVideos.splice(plIndex, 1);
        }
      });

      extraPlVideos.forEach((video) => {
        HighQualityUtils.removeFromPlaylist(playlistId, video.id);
        Logger.log("Removed " + video.title + " from playlist");
      });
    }

    const ripTitles = HighQualityUtils.getCategoryMembers(channel.wiki, "rips");
    const extraRipTitles = ripTitles.slice();

    // Check the wiki for new and existing video / rip articles
    sheetVideos.forEach((sheetVideo, index) => {
      const formattedVideoTitle = HighQualityUtils.formatFandomPageName(sheetVideo.title);
      const wikiIndex = extraRipTitles.indexOf(title => title == formattedVideoTitle);
      const row = parseInt(index) + 2;

      if (wikiIndex != -1) {
        extraRipTitles.splice(wikiIndex, 1);
      }

      if (wikiIndex != -1 && sheetVideo.wikiStatus != "Documented") {
        Logger.log("Now documented: " + sheetVideo.title);
        videoSheet.getRange(row, 3).setValue("Documented");

        if (playlistId && (sheetVideo.youtubeStatus ==  "Public" || sheetVideo.youtubeStatus ==  "Unlisted")) {
          HighQualityUtils.removeFromPlaylist(playlistId, sheetVideo.id);
          Logger.log("Removed " + sheetVideo.title + " from playlist");
        }
      } else if (wikiIndex == -1 && sheetVideo.wikiStatus == "Documented") {
        Logger.log("Now undocumented: " + sheetVideo.title);
        videoSheet.getRange(row, 3).setValue("Undocumented");

        if (playlistId && (sheetVideo.youtubeStatus ==  "Public" || sheetVideo.youtubeStatus ==  "Unlisted")) {
          HighQualityUtils.addToPlaylist(playlistId, sheetVideo.id);
          Logger.log("Added " + sheetVideo.title + " to playlist");
        }
      }
    });

    if (extraRipTitles.length > 0) {
      const message = "Articles missing from " + channel.name + " sheet: " + extraRipTitles.join(", ");
      Logger.log(message);
      HighQualityUtils.logEvent(message);
    }
  });
}
