const channelSheet = SpreadsheetApp.openById("16PLJOqdZOdLXguKmUlUwZfu-1rVXzuJLHbY18BUSOAw")
const channels = HighQualityUtils.getSheetValues(channelSheet, "channel");

/**
 * Checks for newly uploaded rips.
 */
function checkRecentVideos() {

  channels.forEach((channel) => {
    Logger.log("Working on " + channel.name);
    const videoSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(channel.name);
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

  channels.forEach((channel) => {
    Logger.log("Working on " + channel.name);
    const videoSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(channel.name);
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
      Logger.log("Added " + newVideos.length + " new videos");
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

  // TODO

  // Fetch sheet data
  // Fetch video data
  // Loop through videos

  // Check video details
  // Update video changelog

  // Update video statistics
  // Update sheet data

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
