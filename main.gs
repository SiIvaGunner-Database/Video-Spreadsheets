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
        newVideos.add(recentVideo);
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
          missingVideos.add(sheetVideo);
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

    // Update video data
    for (let i in sheetVideos) {
      const sheetVideo = sheetVideos[i];
      const row = parseInt(i) + 2;
      Logger.log("Updating row " + row + ": " + sheetVideo.title);
      const ytVideo = ytVideos.filter((ytVideo) => { ytVideo.id == sheetVideo.id })[0];

      if (!ytVideo) {
        Logger.log("No corresponding video found; skipping row...");
        continue;
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
      sheetVideos[i] = sheetVideo;
    }

    HighQualityUtils.updateInSheet(videoSheet, sheetVideos, 2)
  });

}

/**
 * Checks for video status changes.
 */
function checkVideoStatuses() {

  // TODO

  // Fetch sheet data
  // Fetch channel uploads data
  // Find videos missing from uploads

  // Loop through missing uploads
  // Check video status
  // Update video changelog

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
