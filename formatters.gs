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
