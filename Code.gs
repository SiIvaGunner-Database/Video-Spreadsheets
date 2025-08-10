const scriptProperties = PropertiesService.getScriptProperties()

// IMPORTANT! Enable dev mode when testing.
// HighQualityUtils.settings().enableDevMode()
HighQualityUtils.settings().setAuthToken(scriptProperties).disableYoutubeApi()

// Get channels from database
console.log("Fetching channels from database")
const channelOptions = {
  "channelStatus": "Public",
  "fields": "id,title,wiki,productionSpreadsheet,developmentSpreadsheet,productionChangelogSpreadsheet,developmentChangelogSpreadsheet,productionUndocumentedRipsPlaylist,developmentUndocumentedRipsPlaylist"
}
const channels = HighQualityUtils.channels().getAll(channelOptions)
const spreadsheetBotId = HighQualityUtils.settings().getBotId()

/**
 * Check all channels for newly uploaded rips.
 */
function checkAllRecentVideos() {
  HighQualityUtils.settings().enableYoutubeApi()

  const bigThreeChannelIds = ["UC9ecwl3FTG66jIKA9JRDtmg", "UCCPGE1kAoonfPsbieW41ZZA", "UCIXM2qZRG9o4AFmEsKZUIvQ"]
  const channelIndexKey = "checkRecentVideos.channelIndex"
  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))

  // Check three or four channels every time the script runs; each of the big three plus one fan channel
  channels.forEach((channel, index) => {
    // If it's not the channel's turn and the channel isn't part of the the big three, skip it
    if (index !== channelIndex && bigThreeChannelIds.includes(channel.getId()) === false) {
      return
    }

    console.log(`Checking recent ${channel.getDatabaseObject().title} [${index}] videos`)
    const options = {
      "youtubeLimit": 50,
      "databaseLimit": 1000,
      "parameters": {
        "fields": "id",
        "ordering": "-publishedAt"
      }
    }
    const [videos] = channel.getVideos(options)
    console.log(videos.length + " recent videos")
    videos.forEach(video => checkNewVideo(video))
  })

  // If this is the last of the videos to update for this channel
  if (channelIndex >= channels.length - 1) {
    channelIndex = 0
  } else {
    channelIndex++
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
}

/**
 * Add a public video to the database if it's missing.
 * @param {Video} video - The video object.
 */
function checkNewVideo(video) {
  if (video.getDatabaseObject() !== undefined) {
    console.log(`${video.getId()} has already been added to the database`)
    return
  }

  console.log(`New video: ${video.getId()}`)
  const channel = video.getChannel()
  const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

  if (undocumentedRipsPlaylist !== undefined) {
    undocumentedRipsPlaylist.addVideo(video.getId())
  }

  const videoDefaults = {}

  // If the channel has a wiki, add the video's wiki title
  if (video.getChannel().getDatabaseObject().wiki !== "") {
    videoDefaults.wikiTitle = HighQualityUtils.utils().formatWikiPageName(video.getOriginalObject().title)
  }

  video.createDatabaseObject(videoDefaults)

  // If the channel has a video sheet, insert a row for the new video
  if (channel.hasSheet() === true) {
    const videoValues = [[
      HighQualityUtils.utils().formatYoutubeHyperlink(video.getId()),
      video.getWikiHyperlink(),
      "Undocumented", // Wiki status
      "Public", // YouTube status
      HighQualityUtils.utils().formatDate(video.getDatabaseObject().publishedAt),
      video.getDatabaseObject().duration,
      video.getDatabaseObject().description,
      video.getDatabaseObject().viewCount,
      video.getDatabaseObject().likeCount,
      0, // Dislike count
      video.getDatabaseObject().commentCount
    ]]

    // If the channel is SiIvaGunner, add the video's wiki title to the sheet
    if (video.getChannel().getId() === "UC9ecwl3FTG66jIKA9JRDtmg") {
      videoValues[0].push(videoDefaults.wikiTitle)
    }

    channel.getSheet().insertValues(videoValues).sort(5, false)
  }
}

/**
 * Check all channels for video details and statistics updates.
 */
function checkAllVideoDetails() {
  HighQualityUtils.settings().enableYoutubeApi()

  const videoLimit = 1000
  const channelIndexKey = "checkVideoDetails.channelIndex"
  const pageNumberKey = "checkVideoDetails.pageNumber"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let pageNumber = Number(scriptProperties.getProperty(pageNumberKey)) + 1
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} [${channelIndex}] video details`)

  // For now, videos().getAll() is used instead of channel.getVideos() because it doesn't fetch any extraneous database or youtube videos.
  // In the future, I may want to use a YouTube pageToken instead of the database API page number, but I will have to fix getByFilter() first.
  // const options = {
  //   "pageToken": pageToken,
  //   "limit": videoLimit,
  //   "parameters": { "videoStatus__in": "Public,Unlisted" }
  // }
  // const [videos] = channel.getVideos(options)

  const parameters = {
    "videoStatus__in": "Public,Unlisted",
    "channel": channel.getId(),
    "page": pageNumber
  }

  let videos = []
  try {
    videos = HighQualityUtils.videos().getAll(parameters, videoLimit)
  } catch (e) {
    console.error("An error occurred during fetch from database videos API; ending runtime\n", e.stack)
  }

  const videoValues = []
  const titleChangelogValues = []
  const descriptionChangelogValues = []

  // Check for updates on each video
  videos.forEach(video => {
    const videoDetails = getVideoDetails(video)
    videoValues.push(...videoDetails.videoValues)
    titleChangelogValues.push(...videoDetails.titleChangelogValues)
    descriptionChangelogValues.push(...videoDetails.descriptionChangelogValues)
  })

  // Push the updates to the database, channel sheet, and changelog sheet
  if (titleChangelogValues.length > 0) {
    console.log(`Inserting ${titleChangelogValues.length} rows to title changelog`)
    const titleChangelogSheet = channel.getChangelogSpreadsheet().getSheet("Titles")
    titleChangelogSheet.insertValues(titleChangelogValues).sort(5, false)
  }

  if (descriptionChangelogValues.length > 0) {
    console.log(`Inserting ${descriptionChangelogValues.length} rows to description changelog`)
    const descriptionChangelogSheet = channel.getChangelogSpreadsheet().getSheet("Descriptions")
    descriptionChangelogSheet.insertValues(descriptionChangelogValues).sort(6, false)
  }

  // If the channel has a video sheet, update rows with the updated video values
  if (videoValues.length > 0 && channel.hasSheet() === true) {
    const videoSheet = channel.getSheet()
    const colAValues = videoSheet.getOriginalObject().getRange("A2:A").getValues()
    const rowIndexMap = new Map(colAValues.map((colAValues, index) => [colAValues[0], index + 2]))
    const valuesToInsert = []
    console.log(`${colAValues.length} videos currently listed in video sheet`)

    videos.forEach((video, index) => {
      const rowValues = [videoValues[index]]
      const rowIndex = rowIndexMap.get(video.getId())

      if (rowIndex === undefined) {
        console.log(`No row found for ID ${video.getId()}`)
        valuesToInsert.push(rowValues[0])
      } else {
        console.log(`Updating row ${rowIndex} with ID ${video.getId()}`)
        videoSheet.updateValues(rowValues, rowIndex)
      }
    })

    if (valuesToInsert.length > 0) {
      console.log(`Inserting ${valuesToInsert.length} missing rows into sheet`)
      videoSheet.insertValues(valuesToInsert)
      videoSheet.sort(5, false)
    }
  }

  console.log(`Updating database content`)
  HighQualityUtils.videos().updateAll(videos)

  // If there are no more videos and this is the last channel
  if (videos.length < videoLimit && channelIndex >= channels.length - 1) {
    channelIndex = 0
    pageNumber = 0
  } else if (videos.length < videoLimit) {
    channelIndex++
    pageNumber = 0
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
  scriptProperties.setProperty(pageNumberKey, pageNumber)
}

/**
 * Get a video's details and statistics values as well as title and description changelog values if the values have changed.
 * @param {Video} video - The video object.
 * @return {Object} An object containing three arrays: { videoValues: Array[String|Number|Date]; titleChangelogValues: Array[String|Date]; descriptionChangelogValues: Array[String|Date]; }
 */
function getVideoDetails(video) {
  const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
  const videoValues = []
  const titleChangelogValues = []
  const descriptionChangelogValues = []
  console.log(`Fetching video details for ID ${video.getId()}`)

  // If any YouTube metadata has changed
  if (video.hasChanges() === true) {
    const changes = video.getChanges()

    // Add specified fields to the changelog sheet
    changes.forEach(change => {
      console.log(change.message)

      if (change.key === "title") {
        const newWikiHyperlink = HighQualityUtils.utils().formatWikiHyperlink(change.newValue, video.getChannel().getDatabaseObject().wiki)
        titleChangelogValues.push([
          videoHyperlink,
          video.getWikiHyperlink(),
          newWikiHyperlink,
          video.getChannel().getDatabaseObject().title,
          change.timestamp
        ])
      } else if (change.key === "description") {
        descriptionChangelogValues.push([
          videoHyperlink,
          video.getWikiHyperlink(),
          change.oldValue,
          change.newValue,
          video.getChannel().getDatabaseObject().title,
          change.timestamp
        ])
      }
    })
  }

  video.update(false)
  videoValues.push([
    videoHyperlink,
    video.getWikiHyperlink(),
    video.getDatabaseObject().wikiStatus,
    video.getDatabaseObject().videoStatus,
    HighQualityUtils.utils().formatDate(video.getDatabaseObject().publishedAt),
    video.getDatabaseObject().duration,
    video.getDatabaseObject().description,
    video.getDatabaseObject().viewCount,
    video.getDatabaseObject().likeCount,
    video.getDatabaseObject().dislikeCount,
    video.getDatabaseObject().commentCount
  ])

  let wikiTitle = video.getDatabaseObject().wikiTitle

  // If the channel has a wiki and the video doesn't have a wiki title or the original title has changed, update the wiki title
  if (video.getChannel().getDatabaseObject().wiki !== "" && (wikiTitle === "" || titleChangelogValues.length > 0)) {
    wikiTitle = HighQualityUtils.utils().formatWikiPageName(video.getDatabaseObject().title)
  }

  // If the channel is SiIvaGunner, add the video's wiki title to the sheet
  if (video.getChannel().getId() === "UC9ecwl3FTG66jIKA9JRDtmg") {
    videoValues[0].push(wikiTitle)
  }

  return {
    "videoValues": videoValues,
    "titleChangelogValues": titleChangelogValues,
    "descriptionChangelogValues": descriptionChangelogValues
  }
}

/**
 * Check all videos for YouTube status changes.
 */
function checkAllVideoStatuses() {
  // Ideally, the video limit should be changed to 50 for better performance, but HighQualityUtils needs to be updated to support that first
  const statusCheckLimit = 50
  const videoLimit = 1000

  const channelIndexKey = "checkVideoStatuses.channelIndex"
  const videoIndexKey = "checkVideoStatuses.videoIndex"
  const pageNumberKey = "checkVideoStatuses.pageNumber"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let videoIndex = Number(scriptProperties.getProperty(videoIndexKey))
  let pageNumber = Number(scriptProperties.getProperty(pageNumberKey))

  if (pageNumber === 0) {
    pageNumber = 1
  }

  const endVideoIndex = videoIndex + statusCheckLimit
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} [${channelIndex}] video statuses ${videoIndex} to ${endVideoIndex} on page ${pageNumber}`)

  const options = {
    "databaseLimit": videoLimit,
    "parameters": {
      "fields": "id,title,channel,videoStatus",
      "page": pageNumber
    }
  }
  // Set an array of all videos on the current page and channel
  const [allVideos] = channel.getVideos(options)
  // Set a separate array of videos in the range we want to check the status of right now
  const videosToUpdate = allVideos.slice(videoIndex, endVideoIndex)
  videosToUpdate.forEach(video => checkVideoStatus(video))
  videoIndex = endVideoIndex

  // If there are no more videos left to check on the page
  if (videoIndex >= videoLimit) {
    videoIndex = 0
    pageNumber++
  } else if (videoIndex >= allVideos.length - 1 && allVideos.length < videoLimit) {
    // Else if there are no more videos left to check on the channel
    videoIndex = 0
    pageNumber = 0

    // If this is the last of the channels
    if (channelIndex >= channels.length - 1) {
      channelIndex = 0
    } else {
      channelIndex++
    }
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
  scriptProperties.setProperty(videoIndexKey, videoIndex)
}

/**
 * Check a video's YouTube status and update it if it's changed.
 * @param {Video} video - The video object.
 */
function checkVideoStatus(video = HighQualityUtils.videos().getById("_Pj6PW8YU24")) {
  console.log(`Checking video status for ID "${video.getId()}"`)
  const oldStatus = video.getDatabaseObject().videoStatus
  const currentStatus = video.getYoutubeStatus()

  // If the YouTube status has changed
  if (oldStatus !== currentStatus) {
    console.log(`Old status: ${oldStatus}\nNew status: ${currentStatus}`)
    video.getDatabaseObject().videoStatus = currentStatus
    const channel = video.getChannel()
    const changelogValues = [[
      HighQualityUtils.utils().formatYoutubeHyperlink(video.getId()),
      video.getWikiHyperlink(),
      oldStatus,
      currentStatus,
      channel.getDatabaseObject().title,
      HighQualityUtils.utils().formatDate()
    ]]

    // Push the updates to the database, channel sheet, and changelog sheet
    const changelogSheet = channel.getChangelogSpreadsheet().getSheet("Statuses")
    changelogSheet.insertValues(changelogValues).sort(6, false)

    // If the channel has a video sheet, update the row for the video
    if (channel.hasSheet() === true) {
      const videoSheet = channel.getSheet()

      // The use of a try catch here is a temporary bug workaround to avoid errors on videos missing from the sheet
      try {
        const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
        videoSheet.updateValues([[currentStatus]], rowIndex, 4).sort(5, false)
      } catch(error) {
        console.warn(`Failed to find row for video ID ${video.getId()}`, error.stack)
      }
    }

    video.update()
  }
}

/**
 * Check all channel wikis for new rip articles.
 */
function checkAllWikiStatuses() {
  const videoLimit = 5000
  const channelIndexKey = "checkAllWikiStatuses.channelIndex"
  const pageNumberKey = "checkAllWikiStatuses.pageNumber"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let pageNumber = Number(scriptProperties.getProperty(pageNumberKey))
  let videos = []

  if (pageNumber === 0) {
    pageNumber = 1
  }

  while (channelIndex < channels.length) {
    const channel = channels[channelIndex]

    // Skip any channel that doesn't have a wiki
    if (channel.getDatabaseObject().wiki === "") {
      console.log(`${channel.getDatabaseObject().title} doesn't have a wiki`)
      channelIndex++
      continue
    } else if (channel.getDatabaseObject().wiki.includes("https") === false) {
      // Skip all Fandom wikis until the issue with 403 forbidden responses is resolved
      console.log(`Skipping ${channel.getDatabaseObject().title} Fandom wiki`)
      channelIndex++
      continue
    } else {
      videos = checkChannelWikiStatuses(channel, pageNumber, videoLimit)
      break
    }
  }

  // If there are no more videos and this is the last channel
  if (videos.length < videoLimit && channelIndex >= channels.length - 1) {
    channelIndex = 0
    pageNumber = 0
  } else if (videos.length < videoLimit) {
    channelIndex++
    pageNumber = 0
  } else {
    pageNumber += 5
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
  scriptProperties.setProperty(pageNumberKey, pageNumber)
}

/**
 * Check a channel wiki for new rip articles.
 * @param {Channel} channel - The channel object.
 * @param {Number} [pageNumber] - The page number for the database API. Defaults to 1.
 * @param {Number} [videoLimit] - The video limit for the database API. Defaults to no limit.
 * @return {Array[Video]} The videos that were found based on the given parameters.
 */
function checkChannelWikiStatuses(channel = HighQualityUtils.channels().getById("UCIXM2qZRG9o4AFmEsKZUIvQ"), pageNumber = 1, videoLimit) {
  const categoryTitle = (channel.getId() === "UCCPGE1kAoonfPsbieW41ZZA" ? "Vips" : "Rips")
  const wikiCategoryMembers = HighQualityUtils.utils().fetchWikiCategoryMembers(channel.getDatabaseObject().wiki, categoryTitle)
  wikiCategoryMembers.push(...HighQualityUtils.utils().fetchWikiCategoryMembers(channel.getDatabaseObject().wiki, "Videos"))
  const wikiTitles = wikiCategoryMembers.map(categoryMember => categoryMember.title)
  console.log(`Found ${wikiTitles.length} documented ${channel.getDatabaseObject().title} titles`)

  const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

  const options = {
    "databaseLimit": videoLimit,
    "parameters": {
      "fields": "id,title,wikiStatus",
      "page": pageNumber
    }
  }
  const [videos] = channel.getVideos(options)
  const videoMap = new Map()

  // Format each video name to match the wiki pages and create a map of videos for every distinct title
  videos.forEach(video => {
    const dbWikiFormattedTitle = HighQualityUtils.utils().formatWikiPageName(video.getDatabaseObject().title)
    const videosWithSameTitle = [video]

    if (videoMap.has(dbWikiFormattedTitle) === true) {
      videosWithSameTitle.push(...videoMap.get(dbWikiFormattedTitle))
    }

    videoMap.set(dbWikiFormattedTitle, videosWithSameTitle)
  })

  // Check for wiki status updates on new rip articles
  wikiTitles.forEach(wikiTitle => {
    // If an undocumented video has been documented
    if (videoMap.has(wikiTitle) === true && videoMap.get(wikiTitle).some(video => video.getDatabaseObject().wikiStatus !== "Documented") === true) {
      console.log(`Newly documented video: ${wikiTitle}`)

      videoMap.get(wikiTitle).forEach(video => {
        if (undocumentedRipsPlaylist !== undefined) {
          undocumentedRipsPlaylist.removeVideo(video.getId())
        }

        // If the channel has a video sheet, update the row for the video
        if (channel.hasSheet() === true) {
          const videoSheet = channel.getSheet()

          // The use of a try catch here is a temporary bug workaround to avoid errors on videos missing from the sheet
          try {
            const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
            videoSheet.updateValues([["Documented"]], rowIndex, 3)
          } catch(error) {
            console.warn(`Failed to find row for video ID ${video.getId()}`, error.stack)
          }
        }

        video.getDatabaseObject().wikiStatus = "Documented"
        video.update()
      })
    }
  })

  return videos
}

/**
 * Check for and delete rows with duplicated and empty video IDs on channel video sheets.
 */
function checkForDuplicateVideos() {
  channels.forEach(channel => {
    // Skip any channel that doesn't have a video sheet
    if (channel.hasSheet() === false) {
      console.log(`${channel.getDatabaseObject().title} doesn't have a video sheet`)
      return
    }

    console.log(`Checking ${channel.getDatabaseObject().title} for duplicate videos`)
    const sheet = channel.getSheet()
    const videoIds = sheet.getValues("A:A")
    const videoIdMap = new Map()
    let row = 1

    videoIds.forEach(videoId => {
      videoId = videoId[0]
      row++

      if (videoId === "" || videoIdMap.has(videoId) === true) {
        console.warn(`Deleting duplicate row ${row} containing video ID "${videoId}"`)
        sheet.getOriginalObject().deleteRow(row--)
      } else {
        videoIdMap.set(videoId, videoId)
      }
    })
  })
}

/**
 * Check for missing video IDs of deleted/removed videos on channel video sheets.
 */
function checkForRemovedVideosMissingFromSheets() {
  const videoLimit = 5000
  const channelIndexKey = "checkForRemovedVideosMissingFromSheets.channelIndex"
  const pageNumberKey = "checkForRemovedVideosMissingFromSheets.pageNumber"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let pageNumber = Number(scriptProperties.getProperty(pageNumberKey))
  let videos = []

  if (pageNumber === 0) {
    pageNumber = 1
  }

  while (channelIndex < channels.length) {
    const channel = channels[channelIndex]

    // Skip any channel that doesn't have a video sheet
    if (channel.hasSheet() === false) {
      console.log(`${channel.getDatabaseObject().title} doesn't have a video sheet`)
      channelIndex++
      continue
    } else {
      videos = checkForRemovedVideosMissingFromSheet(channel, pageNumber, videoLimit)
      break
    }
  }

  // If there are no more videos and this is the last channel
  if (videos.length < videoLimit && channelIndex >= channels.length - 1) {
    channelIndex = 0
    pageNumber = 0
  } else if (videos.length < videoLimit) {
    channelIndex++
    pageNumber = 0
  } else {
    pageNumber += 5
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
  scriptProperties.setProperty(pageNumberKey, pageNumber)
}

/**
 * Check for missing video IDs of deleted/removed videos on a channel video sheet.
 * @param {Channel} channel - The channel object.
 * @param {Number} [pageNumber] - The page number for the database API. Defaults to 1.
 * @param {Number} [videoLimit] - The video limit for the database API. Defaults to no limit.
 * @return {Array[Video]} The videos that were found based on the given parameters.
 */
function checkForRemovedVideosMissingFromSheet(channel = HighQualityUtils.channels().getById("UCIXM2qZRG9o4AFmEsKZUIvQ"), pageNumber = 1, videoLimit) {
  console.log(`Checking ${channel.getDatabaseObject().title} for missing sheet videos`)
  const parameters = {
    "videoStatus__in": "Private,Deleted,Unavailable",
    "channel": channel.getId(),
    "page": pageNumber
  }
  const databaseVideos = HighQualityUtils.videos().getAll(parameters, videoLimit)
  const sheet = channel.getSheet()
  const sheetVideoIds = sheet.getValues("A:A")
  const sheetVideoIdMap = new Map(sheetVideoIds.map(videoId => [videoId[0], videoId[0]]))
  const videoValues = []
  console.log(`Sheet videos: ${sheetVideoIds.length}\nDatabase videos: ${databaseVideos.length}`)

  databaseVideos.forEach(video => {
    if (sheetVideoIdMap.has(video.getId()) === false) {
      console.warn(`Video with ID "${video.getId()}" is missing from spreadsheet with ID "${sheet.getSpreadsheet().getId()}"`)
      videoValues.push([
        HighQualityUtils.utils().formatYoutubeHyperlink(video.getId()),
        video.getWikiHyperlink(),
        video.getDatabaseObject().wikiStatus,
        video.getDatabaseObject().videoStatus,
        HighQualityUtils.utils().formatDate(video.getDatabaseObject().publishedAt),
        video.getDatabaseObject().duration,
        video.getDatabaseObject().description,
        video.getDatabaseObject().viewCount,
        video.getDatabaseObject().likeCount,
        video.getDatabaseObject().dislikeCount,
        video.getDatabaseObject().commentCount
      ])
    }
  })

  if (videoValues.length > 0) {
    console.log(`Inserting ${videoValues.length} videos into sheet`)
    sheet.insertValues(videoValues).sort(5, false)
  }

  return databaseVideos
}

/**
 * Check for any inconsistencies in undocumented rips playlists.
 */
function checkUndocumentedPlaylists() {
  const videoLimit = 5000
  const channelIndexKey = "checkUndocumentedPlaylists.channelIndex"
  const pageNumberKey = "checkUndocumentedPlaylists.pageNumber"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let pageNumber = Number(scriptProperties.getProperty(pageNumberKey))
  let videos = []

  if (pageNumber === 0) {
    pageNumber = 1
  }

  while (channelIndex < channels.length) {
    const channel = channels[channelIndex]

    // Skip any channel that doesn't have an undocumented videos playlist
    if (channel.getUndocumentedRipsPlaylist() === undefined) {
      console.log(`${channel.getDatabaseObject().title} doesn't have an undocumented videos playlist`)
      channelIndex++
      continue
    } else {
      videos = checkUndocumentedPlaylist(channel, pageNumber, videoLimit)
      break
    }
  }

  // If there are no more videos and this is the last channel
  if (videos.length < videoLimit && channelIndex >= channels.length - 1) {
    channelIndex = 0
    pageNumber = 0
  } else if (videos.length < videoLimit) {
    channelIndex++
    pageNumber = 0
  } else {
    pageNumber += 5
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
  scriptProperties.setProperty(pageNumberKey, pageNumber)
}

/**
 * Check for any inconsistencies in an undocumented rips playlist.
 * @param {Channel} channel - The channel object.
 * @param {Number} [pageNumber] - The page number for the database API. Defaults to 1.
 * @param {Number} [videoLimit] - The video limit for the database API. Defaults to no limit.
 * @return {Array[Video]} The videos that were found based on the given parameters.
 */
function checkUndocumentedPlaylist(channel = HighQualityUtils.channels().getById("UCIXM2qZRG9o4AFmEsKZUIvQ"), pageNumber = 1, videoLimit) {
  console.log(`Checking ${channel.getDatabaseObject().title} undocumented rips playlist`)
  const options = {
    "databaseLimit": videoLimit,
    "parameters": {
      "fields": "id,wikiStatus,videoStatus",
      "page": pageNumber
    }
  }
  const [databaseVideos] = channel.getVideos(options)
  const databaseVideoIdMap = new Map(databaseVideos.map(video => [video.getId(), video]))
  const playlist = channel.getUndocumentedRipsPlaylist()
  const playlistVideoIds = HighQualityUtils.youtube().getPlaylistVideoIds(playlist.getId())
  const playlistVideoIdMap = new Map(playlistVideoIds.map(videoId => [videoId, videoId]))
  console.log(`Playlist videos: ${playlistVideoIds.length}\nDatabase videos: ${databaseVideos.length}`)

  databaseVideos.forEach(video => {
    if (video.getDatabaseObject().wikiStatus === "Undocumented" && playlistVideoIdMap.has(video.getId()) === false) {
      const videoStatus = video.getDatabaseObject().videoStatus
      console.warn(`Undocumented ${videoStatus} video with ID "${video.getId()}" is missing from playlist with ID "${playlist.getId()}"`)

      if (videoStatus === "Public" || videoStatus === "Unlisted") {
        try {
          playlist.addVideo(video.getId())
        } catch (error) {
          console.warn(error.stack)
        }
      }
    }
  })

  playlistVideoIdMap.forEach(videoId => {
    if (databaseVideoIdMap.has(videoId) === true && databaseVideoIdMap.get(videoId).getDatabaseObject().wikiStatus === "Documented") {
      console.warn(`Documented video with ID "${videoId}" is in playlist with ID "${playlist.getId()}"`)
      playlist.removeVideo(videoId)
    }
  })

  return databaseVideos
}
