/**
 * Checks for newly uploaded rips.
 */
function checkRecentVideos() {

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const recentVideos = HighQualityUtils.getChannelUploads(channel.id, 50);
    const newVideos = [];

    // Find any new videos
    recentVideos.forEach((recentVideo) => {
      if (!sheetVideos.includes()) {
        newVideos.push(recentVideo);
        Logger.log("New video: " + recentVideo.title);
      }
    });

    // Add any new videos to the sheet and database
    if (newVideos) {
      HighQualityUtils.addToSheet(videoSheet, newVideos);
      HighQualityUtils.postToVideoDb(newVideos);
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

  const allDbVideos = HighQualityUtils.getFromVideoDb();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw");
  const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

  channels.forEach((channel) => {
    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const dbVideos = allDbVideos.filter((dbVideo) => { dbVideo.channel == channel.id });
    const missingVideos = [];

    // Find any videos missing from the database
    if (sheetVideos.length > dbVideos.length) {
      sheetVideos.forEach((sheetVideo) => {
        if (!dbVideos.includes()) {
          missingVideos.push(sheetVideo);
          Logger.log("Missing video: " + sheetVideo.title);
        }
      });
    }

    // Add any missing videos to the database
    if (missingVideos) {
      HighQualityUtils.postToVideoDb(missingVideos);
      Logger.log("Added " + missingVideos.length + " missing videos");
    } else {
      Logger.log("No missing videos found");
    }

    // Update all data in the database
    HighQualityUtils.postToVideoDb(sheetVideos);
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
    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const videoIds = sheetVideos.map((sheetVideo) => { return sheetVideo.id });
    const ytVideos = HighQualityUtils.getVideos(videoIds);

    sheetVideos.forEach((sheetVideo, sheetIndex) => {
      Logger.log("Updating " + sheetVideo.title);
      const ytIndex = ytVideos.indexOf((ytVideo) => { ytVideo.id == sheetVideo.id })[0];
      const ytVideo = ytVideos[ytIndex];

      if (!ytVideo) {
        Logger.log("No corresponding video found; skipping row...");
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
    Logger.log("Working on " + channel.name);
    const videoSheet = spreadsheet.getSheetByName(channel.name);
    const sheetVideos = HighQualityUtils.getSheetValues(videoSheet, "video");
    const ytVideos = HighQualityUtils.getChannelUploads(channel.id);
    const vidsMissingFromSheet = ytVideos.slice();

    sheetVideos.forEach((sheetVideo, sheetIndex) => {
      Logger.log("Updating " + sheetVideo.title);
      const row = parseInt(sheetIndex) + 2;
      const ytIndex = ytVideos.indexOf((ytVideo) => { ytVideo.id == sheetVideo.id })[0];
      const ytVideo = ytVideos[ytIndex];

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
        vidsMissingFromSheet.splice(ytIndex, 1);

        if (sheetVideo.youtubeStatus != "Public") {
          HighQualityUtils.logChange(statusChangelogSheet, sheetVideo.id, "YouTube Status", sheetVideo.youtubeStatus, "Public");
          sheetVideo.youtubeStatus = "Public";
          HighQualityUtils.updateInSheet(videoSheet, sheetVideo, row);
          Logger.log("New status: Public");
        }
      }
    });

    if (vidsMissingFromSheet.length > 0) {
      const missingIds = vidsMissingFromSheet.map((video) => { return video.id });
      const message = "Videos missing from " + channel.name + " sheet: " + missingIds.join(", ");
      Logger.log(message);
      HighQualityUtils.logEvent(message);
      HighQualityUtils.addToSheet(videoSheet, vidsMissingFromSheet);
      Logger.log("Added " + vidsMissingFromSheet.length + " missing videos");
    }
  });

}

/**
 * Checks for wiki status changes.
 */
function checkWikiStatuses() {

  // TODO

  // Fetch undocumented rips from sheet data
  // Fetch undocumented rips from playlist
  // Check for consistency
  // Add / remove from playlist

  // Fetch category:rips data
  // Check for new / existing articles
  // Add / remove from playlist

}
