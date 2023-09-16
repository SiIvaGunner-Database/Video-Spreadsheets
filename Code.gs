const scriptProperties = PropertiesService.getScriptProperties()

// IMPORTANT! Enable dev mode when testing.
HighQualityUtils.settings().enableDevMode()
HighQualityUtils.settings().setAuthToken(scriptProperties)

// Get channels from database
console.log("Fetching channels from database")
const channels = HighQualityUtils.channels().getAll({ "channelStatus": "Public" })
const spreadsheetBotId = HighQualityUtils.settings().getBotId()

/**
 * Check all channels for newly uploaded rips.
 */
function checkAllRecentVideos() {
  const channelIndexKey = "checkRecentVideos.channelIndex"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  const channel = channels[channelIndex]
  console.log(`Checking recent ${channel.getDatabaseObject().title} [${channelIndex}] videos`)

  const options = {
    "youtubeLimit": 50,
    "databaseLimit": 1000,
    "parameters": {
      "fields": "id",
      "ordering": "-publishedAt"
    }
  }
  const [videos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options)
  console.log(videos.length + " recent videos")
  videos.forEach(video => checkNewVideo(video))

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

  if (undocumentedRipsPlaylist !== undefined && channel.getOriginalObject().wiki !== "") {
    undocumentedRipsPlaylist.addVideo(video.getId())
  }

  video.createDatabaseObject()
  const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
  const videoValues = [[
    videoHyperlink,
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
  channel.getSheet().insertValues(videoValues).sort(5, false)
}

/**
 * Check all channels for video details and statistics updates.
 */
function checkAllVideoDetails() {
  const videoLimit = 1000
  const channelIndexKey = "checkVideoDetails.channelIndex"
  const pageNumberKey = "checkVideoDetails.pageNumber"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let pageNumber = Number(scriptProperties.getProperty(pageNumberKey)) + 1
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} [${channelIndex}] video details`)

  const parameters = {
    "videoStatus__in": "Public,Unlisted",
    "channel": channel.getId(),
    "page": pageNumber
  }
  const videos = HighQualityUtils.videos().getAll(parameters, videoLimit)
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

  if (videoValues.length > 0) {
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

  // If there are no more videos and this is the last channel to update
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
        const newWikiHyperlink = HighQualityUtils.utils().formatFandomHyperlink(change.newValue, video.getChannel().getDatabaseObject().wiki)
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
  HighQualityUtils.settings().disableYoutubeApi()

  const videoLimit = 50
  const channelIndexKey = "checkVideoStatuses.channelIndex"
  const videoIndexKey = "checkVideoStatuses.videoIndex"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  let videoIndex = Number(scriptProperties.getProperty(videoIndexKey))

  if (isSheetLocked(channelIndexKey, channelIndex) === true) {
    console.warn("Conflicting scripts running. Ending current execution.")
  }

  const endVideoIndex = videoIndex + videoLimit
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} [${channelIndex}] video statuses ${videoIndex} to ${endVideoIndex}`)

  const options = { "parameters": { "fields": "id,title,channel,videoStatus" } }
  const [allVideos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options)
  const videosToUpdate = allVideos.slice(videoIndex, endVideoIndex)
  videosToUpdate.forEach(video => checkVideoStatus(video))
  videoIndex = endVideoIndex

  // If this is the last of the videos to update for this channel
  if (videoIndex >= allVideos.length - 1) {
    videoIndex = 0

    // If this is the last of the channels to update
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
    const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
    const changelogValues = [[
      videoHyperlink,
      video.getWikiHyperlink(),
      oldStatus,
      currentStatus,
      channel.getDatabaseObject().title,
      HighQualityUtils.utils().formatDate()
    ]]

    // Push the updates to the database, channel sheet, and changelog sheet
    const changelogSheet = channel.getChangelogSpreadsheet().getSheet("Statuses")
    changelogSheet.insertValues(changelogValues).sort(6, false)
    const videoSheet = channel.getSheet()
    const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
    videoSheet.updateValues([[currentStatus]], rowIndex, 4).sort(5, false)
    video.update()
  }
}

/**
 * Check all channel wikis for new rip articles.
 */
function checkAllWikiStatuses() {
  HighQualityUtils.settings().disableYoutubeApi()
  channels.forEach(channel => checkChannelWikiStatuses(channel))
}

/**
 * Check a channel wiki for new rip articles.
 * @param {Channel} channel - The channel object.
 */
function checkChannelWikiStatuses(channel = HighQualityUtils.channels().getById("UCIXM2qZRG9o4AFmEsKZUIvQ")) {
  HighQualityUtils.settings().disableYoutubeApi()

  // Skip any channel that doesn't have a wiki
  if (channel.getDatabaseObject().wiki === "") {
    console.log(`${channel.getDatabaseObject().title} doesn't have a wiki`)
    return
  }

  const categoryTitle = (channel.getId() === "UCCPGE1kAoonfPsbieW41ZZA" ? "Vips" : "Rips")
  const wikiCategoryMembers = HighQualityUtils.utils().fetchFandomCategoryMembers(channel.getDatabaseObject().wiki, categoryTitle)
  const wikiTitles = wikiCategoryMembers.map(categoryMember => categoryMember.title)
  console.log(`Found ${wikiTitles.length} documented ${channel.getDatabaseObject().title} titles`)

  const videoSheet = channel.getSheet()
  const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

  const options = { "parameters": { "fields": "id,title,wikiStatus" } }
  const [videos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options)
  const videoMap = new Map(videos.map(video => {
    const dbWikiFormattedTitle = HighQualityUtils.utils().formatFandomPageName(video.getDatabaseObject().title)
    return [dbWikiFormattedTitle, video]
  }))

  // Check for wiki status updates on new rip articles
  wikiTitles.forEach(wikiTitle => {
    // If an undocumented video has been documented
    if (videoMap.has(wikiTitle) === true && videoMap.get(wikiTitle).getDatabaseObject().wikiStatus !== "Documented") {
      console.log(`Newly documented video: ${wikiTitle}`)
      const video = videoMap.get(wikiTitle)
      undocumentedRipsPlaylist.removeVideo(video.getId())
      video.getDatabaseObject().wikiStatus = "Documented"
      const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
      videoSheet.updateValues([["Documented"]], rowIndex, 3)
      video.update()
    }
  })
}

/**
 * Check whether or not the specified channel videos sheet is being used by another process. Experimental.
 * @return {Boolean} Whether or not the given sheet is locked.
 */
function isSheetLocked(indexKeyToIgnore, channelIndex) {
  const indexKeys = ["checkRecentVideos.channelIndex", "checkVideoDetails.channelIndex", "checkVideoStatuses.channelIndex"]
  const indexNumbers = []

  indexKeys.forEach(key => {
    if (key !== indexKeyToIgnore) {
      indexNumbers.push(Number(scriptProperties.getProperty(key)))
    }
  })

  return indexNumbers.includes(channelIndex)
}

/**
 * Delete and recreate project triggers.
 */
function resetTriggers() {
  HighQualityUtils.settings().deleteTriggers()
  ScriptApp.newTrigger('checkAllRecentVideos').timeBased().everyMinutes(5).create()
  console.log("Waiting one minute...")
  Utilities.sleep(60000)
  ScriptApp.newTrigger('checkAllVideoDetails').timeBased().everyMinutes(5).create()
  console.log("Waiting two minutes...")
  Utilities.sleep(120000)
  ScriptApp.newTrigger('checkAllVideoStatuses').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkAllWikiStatuses').timeBased().everyHours(1).create()
  console.log("All project triggers have been reset to their default times")
}
