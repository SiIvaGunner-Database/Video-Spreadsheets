const scriptProperties = PropertiesService.getScriptProperties()

// IMPORTANT! Enable dev mode when testing.
// HighQualityUtils.settings().enableDevMode()
HighQualityUtils.settings().setAuthToken(scriptProperties)

// Get channels from database
const channels = HighQualityUtils.channels().getAll({ "channelStatus": "Public" })
const spreadsheetBotId = HighQualityUtils.settings().getBotId()

/**
 * Check all channels for newly uploaded rips.
 */
function checkAllRecentVideos() {
  const channelIndexKey = "checkRecentVideos.channelIndex"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  const channel = channels[channelIndex]
  console.log(`Checking recent ${channel.getDatabaseObject().title} videos`)

  const options = { "limit": 50 }
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
 * @return {Video, Array[Object]} An array containing the video and the video values.
 */
function checkNewVideo(video) {
  if (video.getDatabaseObject() !== undefined) {
    console.log(`${video.getId()} has already been added to the database`)
    return [video, undefined]
  }

  console.log(`New video: ${video.getId()}`)
  const channel = video.getChannel()
  const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

  if (undocumentedRipsPlaylist !== undefined) {
    undocumentedRipsPlaylist.addVideo(video.getId())
  }

  video.createDatabaseObject()
  const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
  const videoValues = [[
    videoHyperlink,
    video.getWikiHyperlink(),
    video.getDatabaseObject().wikiStatus,
    video.getDatabaseObject().videoStatus,
    HighQualityUtils.utils().formatDate(video.getDatabaseObject().publishedAt),
    video.getDatabaseObject().duration,
    video.getDatabaseObject().description,
    video.getDatabaseObject().viewCount,
    video.getDatabaseObject().likeCount,
    0, // Dislike count
    video.getDatabaseObject().commentCount
  ]]
  channel.getSheet().insertValues(videoValues).sort(5, false)
  return [video, videoValues]
}

/**
 * Check all channels for video details and statistics updates.
 */
function checkAllVideoDetails() {
  const videoLimit = 500
  const channelIndexKey = "checkVideoDetails.channelIndex"
  const pageTokenKey = "checkVideoDetails.pageToken"

  let channelIndex = Number(scriptProperties.getProperty(channelIndexKey))
  const pageToken = scriptProperties.getProperty(pageTokenKey)
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} video details`)

  const options = {
    "limit": videoLimit,
    "pageToken": pageToken
  }
  const [videos, nextPageToken] = HighQualityUtils.videos().getByChannelId(channel.getId(), options)
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

    // This would be a bit faster if a single range was updated in one shot. However, that would be more complicated
    // to implement because removed videos don't appear in the videos array but do appear in sheet rows.
    videos.forEach((video, index) => {
      const rowValues = [videoValues[index]]
      const rowIndex = rowIndexMap.get(video.getId())
      console.log(`Updating video sheet row ${rowIndex} with ID ${video.getId()}`)
      videoSheet.updateValues(rowValues, rowIndex)
    })
  }

  HighQualityUtils.videos().updateAll(videos)

  // If there are no more videos and this is the last channel to update
  if (nextPageToken === undefined && channelIndex >= channels.length - 1) {
    channelIndex = 0
  } else {
    channelIndex++
  }

  scriptProperties.setProperty(channelIndexKey, channelIndex)
  scriptProperties.setProperty(pageTokenKey, nextPageToken | "")
}

/**
 * Get a video's details and statistics values as well as title and description changelog values if the values have changed.
 * @param {Video} video - The video object.
 * @return {Object} An object containing three arrays: { videoValues: Array[String|Number|Date]; titleChangelogValues: Array[String|Date]; descriptionChangelogValues: Array[String|Date]; }
 */
function getVideoDetails(video) {
  if (video.getDatabaseObject() === undefined) {
    console.log(`Adding ${video.getId()} to database`)
    const [newVideo, newVideoValues] = checkNewVideo(video)
    return {
      "videoValues": newVideoValues,
      "titleChangelogValues": [],
      "descriptionChangelogValues": []
    }
  }

  const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
  const videoValues = []
  const titleChangelogValues = []
  const descriptionChangelogValues = []
  console.log(video.getDatabaseObject().title)

  // If any YouTube metadata has changed
  if (video.hasChanges() === true) {
    const changes = video.getChanges()

    // Add specified fields to the changelog sheet
    changes.forEach(change => {
      console.log(change.message)

      if (change.key === "title") {
        const newWikiHyperlink = HighQualityUtils.utils().formatFandomHyperlink(change.newValue, channel.getDatabaseObject().wiki)
        titleChangelogValues.push([
          videoHyperlink,
          video.getWikiHyperlink(),
          newWikiHyperlink,
          channel.getDatabaseObject().title,
          change.timestamp
        ])
      } else if (change.key === "description") {
        descriptionChangelogValues.push([
          videoHyperlink,
          video.getWikiHyperlink(),
          change.oldValue,
          change.newValue,
          channel.getDatabaseObject().title,
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
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} video statuses`)

  const options = { fields: "id,videoStatus" }
  const [videos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options).slice(videoIndex, videoIndex + videoLimit)
  videos.forEach(video => checkVideoStatus(video))
  videoIndex += videoLimit

  // If this is the last of the videos to update for this channel
  if (videoIndex >= videos.length - 1) {
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
  console.log(`Checking video status of ${video.getDatabaseObject().title}`)
  const oldStatus = video.getDatabaseObject().videoStatus
  const currentStatus = video.getYoutubeStatus()

  // If the YouTube status has changed
  if (oldStatus !== currentStatus) {
    console.log(`Old status: ${oldStatus}\nNew status: ${currentStatus}`)
    video.getDatabaseObject().videoStatus = currentStatus
    const channel = video.getChannel()
    const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
    const changelogValues = [
      videoHyperlink,
      video.getWikiHyperlink(),
      oldStatus,
      currentStatus,
      channel.getDatabaseObject().title,
      HighQualityUtils.utils().formatDate()
    ]

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
  if (channel.getDatabaseObject().wiki === "" || channel.getDatabaseObject().wiki === "None") {
    console.log(`${channel.getDatabaseObject().title} doesn't have a wiki`)
    return
  }

  const categoryTitle = (channel.getId() === "UCCPGE1kAoonfPsbieW41ZZA" ? "Vips" : "Rips")
  const wikiCategoryMembers = HighQualityUtils.utils().fetchFandomCategoryMembers(channel.getDatabaseObject().wiki, categoryTitle)
  const wikiTitles = wikiCategoryMembers.map(categoryMember => categoryMember.title)
  console.log(`Found ${wikiTitles.length} documented ${channel.getDatabaseObject().title} titles`)

  const videoSheet = channel.getSheet()
  const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

  const options = { fields: "id,title" }
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
      undocumentedRipsPlaylist.removeVideo(video.getId())
      video.getDatabaseObject().wikiStatus = "Documented"
      const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
      videoSheet.updateValues([["Documented"]], rowIndex, 3)
      video.update()
    } 
  })
}

/**
 * Delete and recreate project triggers.
 */
function resetTriggers() {
  HighQualityUtils.settings().deleteTriggers()
  ScriptApp.newTrigger('checkAllRecentVideos').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkAllVideoDetails').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkAllVideoStatuses').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkAllWikiStatuses').timeBased().everyMinutes(60).create()
}
