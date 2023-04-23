// IMPORTANT! Enable dev mode when testing.
HighQualityUtils.settings().enableDevMode()
HighQualityUtils.settings().setAuthToken(ScriptProperties)

// Get channels from database
const spreadsheetBotId = HighQualityUtils.settings().getBotId()
const channels = HighQualityUtils.channels().getAll()

/**
 * Checks for newly uploaded rips.
 */
function checkRecentVideos() {
  const channelIndexKey = "checkRecentVideos.channelIndex"

  let channelIndex = Number(ScriptProperties.getProperty(channelIndexKey))
  const channel = channels[channelIndex]
  console.log(`Checking recent ${channel.getDatabaseObject().title} videos`)

  const videoSheet = channel.getSheet()
  const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

  const options = { "limit": 50 }
  const [videos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options)

  videos.forEach(video => {
    if (video.getDatabaseObject() === undefined) {
      console.log(`New video: ${video.getid()}`)
      undocumentedRipsPlaylist.addVideo(video.getId())
      const defaults = {
        "wikiStatus": "Undocumented",
        "videoStatus": "Public"
      }
      video.createDatabaseObject(defaults)
      const videoValues = [[
        videoHyperlink,
        video.getWikiHyperlink(),
        defaults.wikiStatus,
        defaults.videoStatus,
        video.getDatabaseObject().publishedAt,
        video.getDatabaseObject().duration,
        video.getDatabaseObject().description,
        video.getDatabaseObject().viewCount,
        video.getDatabaseObject().likeCount,
        0, // Dislike count
        video.getDatabaseObject().commentCount
      ]]
      videoSheet.insertValues(videoValues)
      videoSheet.sort(5)
    } else {
      console.log(`Skipping ${video.getid()}`)
    } 
  })

  // If this is the last of the videos to update for this channel
  if (channelIndex >= channels.length - 1) {
    channelIndex = 0
  } else {
    channelIndex++
  }

  ScriptProperties.setProperty(channelIndexKey, channelIndex)
}

/**
 * Checks for video details and statistics updates.
 */
function checkVideoDetails() {
  const videoLimit = 500
  const channelIndexKey = "checkVideoDetails.channelIndex"
  const pageTokenKey = "checkVideoDetails.pageToken"

  let channelIndex = Number(ScriptProperties.getProperty(channelIndexKey))
  const pageToken = ScriptProperties.getProperty(pageTokenKey)
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
    const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
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

    videoValues.push([
      videoHyperlink,
      video.getWikiHyperlink(),
      video.getDatabaseObject().wikiStatus,
      video.getDatabaseObject().videoStatus,
      video.getDatabaseObject().publishedAt,
      video.getDatabaseObject().duration,
      video.getDatabaseObject().description,
      video.getDatabaseObject().viewCount,
      video.getDatabaseObject().likeCount,
      video.getDatabaseObject().dislikeCount,
      video.getDatabaseObject().commentCount
    ])
  })

  const videoSheet = channel.getSheet()
  const titleChangelogSheet = channel.getChangelogSpreadsheet().getSheet("Titles")
  const descriptionChangelogSheet = channel.getChangelogSpreadsheet().getSheet("Descriptions")

  // Push the updates to the database, channel sheet, and changelog sheet
  titleChangelogSheet.insertValues(changelogValues)
  titleChangelogSheet.sort(5, false)

  descriptionChangelogSheet.insertValues(changelogValues)
  descriptionChangelogSheet.sort(6, false)

  const rowIndex = videoSheet.getRowIndexOfValue(videos[0].getId())
  videoSheet.updateValues(videoValues, rowIndex)
  videoSheet.sort(5)
  HighQualityUtils.videos().updateAll(videos)

  // If there are no more videos and this is the last channel to update
  if (nextPageToken === undefined && channelIndex >= channels.length - 1) {
    channelIndex = 0
  } else {
    channelIndex++
  }

  ScriptProperties.setProperty(channelIndexKey, channelIndex)
  ScriptProperties.setProperty(nextPageTokenKey, nextPageToken)
}

/**
 * Checks for video status changes.
 */
function checkVideoStatuses() {
  HighQualityUtils.settings().disableYoutubeApi()

  const videoLimit = 50
  const channelIndexKey = "checkVideoStatuses.channelIndex"
  const videoIndexKey = "checkVideoStatuses.videoIndex"

  let channelIndex = Number(ScriptProperties.getProperty(channelIndexKey))
  let videoIndex = Number(ScriptProperties.getProperty(videoIndexKey))
  const channel = channels[channelIndex]
  console.log(`Checking ${channel.getDatabaseObject().title} video statuses`)

  const options = { fields: "id,videoStatus" }
  const [videos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options).slice(videoIndex, videoIndex + videoLimit)

  const videoSheet = channel.getSheet()
  const changelogSheet = channel.getChangelogSpreadsheet().getSheet("Statuses")

  // Check for status changes on each video
  videos.forEach(video => {
    const videoHyperlink = HighQualityUtils.utils().formatYoutubeHyperlink(video.getId())
    console.log(video.getDatabaseObject().title)

    const oldStatus = video.getDatabaseObject().videoStatus
    const currentStatus = video.getYoutubeStatus()

    // If the YouTube status has changed
    if (oldStatus !== currentStatus) {
      console.log(`Old status: ${oldStatus}\nNew status: ${currentStatus}`)
      video.getDatabaseObject().videoStatus = currentStatus
      const changelogValues = [
        videoHyperlink,
        video.getWikiHyperlink(),
        oldStatus,
        currentStatus,
        channel.getDatabaseObject().title,
        HighQualityUtils.utils().formatDate()
      ]

      // Push the updates to the database, channel sheet, and changelog sheet
      changelogSheet.insertValues(changelogValues)
      changelogSheet.sort(6, false)
      const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
      videoSheet.updateValues([[currentStatus]], rowIndex, 4)
      videoSheet.sort(5)
      video.update()
    }
  })

  videoIndex += videoLimit

  // If this is the last of the videos to update for this channel
  if (videoIndex >= sheetVideos.length - 1) {
    videoIndex = 0

    // If this is the last of the channels to update
    if (channelIndex >= channels.length - 1) {
      channelIndex = 0
    } else {
      channelIndex++
    }
  }

  ScriptProperties.setProperty(channelIndexKey, channelIndex)
  ScriptProperties.setProperty(videoIndexKey, videoIndex)
}

/**
 * Checks for wiki status changes.
 */
function checkWikiStatuses() {
  HighQualityUtils.settings().disableYoutubeApi()

  channels.forEach(channel => {
    // Skip any channel that doesn't have a wiki
    if (channel.getDatabaseObject().wiki === "") {
      console.log(`Skipping ${channel.getDatabaseObject().title}`)
      return
    }

    const categoryTitle = (channel.getId() === "UCCPGE1kAoonfPsbieW41ZZA" ? "Vips" : "Rips")
    const wikiTitles = HighQualityUtils.utils().fetchFandomCategoryMembers(channel.getDatabaseObject().wiki, categoryTitle)
    console.log(`Found ${wikiTitles.length} documented ${channel.getDatabaseObject().title} titles`)

    const videoSheet = channel.getSheet()
    const undocumentedRipsPlaylist = channel.getUndocumentedRipsPlaylist()

    const options = { fields: "id,title" }
    const [videos] = HighQualityUtils.videos().getByChannelId(channel.getId(), options) // update service to allow multiple ids?
    const videoMap = new Map(videos.map(video => {
      const dbWikiFormattedTitle = HighQualityUtils.utils().formatFandomPageName(video.getDatabaseObject().title)
      return [dbWikiFormattedTitle, video]
    }))

    // Check for wiki status updates on new rip articles
    wikiTitles.forEach(wikiTitle => {
      // If an undocumented video has been documented
      if (videoMap.has(wikiTitle) && videoMap.get(wikiTitle).getDatabaseObject().wikiStatus !== "Documented") {
        console.log(`Newly documented video: `)
        undocumentedRipsPlaylist.removeVideo(video.getId())
        video.getDatabaseObject().wikiStatus = "Documented"
        const rowIndex = videoSheet.getRowIndexOfValue(video.getId())
        videoSheet.updateValues([["Documented"]], rowIndex, 3)
        video.update()
      } 
    })
  })
}

/**
 * Deletes and recreates project triggers.
 */
function resetTriggers() {
  HighQualityUtils.settings().deleteTriggers()
  ScriptApp.newTrigger('checkRecentVideos').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkVideoDetails').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkVideoStatuses').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('checkWikiStatuses').timeBased().everyMinutes(60).create()
}
