var VIASAT_DETAILS_IMG_SIZE="600x338";
var Viasat =
{
    channel_idx:null,
    channels:[],
    result:[],
    show_ids:[]
};

Viasat.isSubChannelSet = function() {
    return Viasat.channel_idx != null;
}

Viasat.resetSubChannel = function() {
    if (Viasat.channel_idx) {
        Viasat.channel_idx = null;
    }
}

Viasat.getSectionTitle = function(location) {
    if (location.match(/Latest.html/))
        return 'Senaste';
    else if (location.match(/LatestClips.html/))
        return 'Senaste Klipp';
}

Viasat.getCategoryTitle = function() {
    switch (Viasat.getCategoryIndex().current) {
    case 0:
        return "Kategorier";
    case 1:
        return "Utvalt";
    case 2:
        return "Alla Program";
    }
};

Viasat.getUrl = function(tag, extra) {

    var url;

    switch (tag)
    {
    case "main":
        var newChannel = getLocation(extra.refresh).match(/viasat_channel=([0-9]+|reset)/);
        newChannel = (newChannel && newChannel.length > 0) ? newChannel[1] : null;
        if (newChannel && !extra.refresh)
            myHistory = [];
        if (newChannel && Viasat.channel_idx != newChannel) {
            Viasat.resetSubChannel();
            if (newChannel != "reset")
                Viasat.channel_idx = newChannel;
            // Force new channel name
            Header.display(document.title);
        }
        url = 'http://playapi.mtgx.tv/v3/formats?device=mobile&premium=open&country=se&limit=50&order=popularity&page=999';
        // url = 'http://playapi.mtgx.tv/v3/sections?sections=videos.popular&device=mobile&premium=open&country=se';
        break;

    case "section":
        switch (extra.location) {
        case "Latest.html":
            url = 'http://playapi.mtgx.tv/v3/sections?sections=videos.latest&device=mobile&premium=open&country=se'
            break;

        case "LatestClips.html":
            url = 'http://playapi.mtgx.tv/v3/sections?sections=videos.latest_clips&device=mobile&premium=open&country=se'
            break;
        }
        break;

    case "live":
        return 'http://playapi.mtgx.tv/v3/channels?country=se'
        break;

    case "categories":
        switch (Viasat.getCategoryIndex().current) {
        case 0:
            url = 'http://playapi.mtgx.tv/v3/categories?device=mobile&premium=open&country=se&order=name'
            break;
        case 1:
            url = 'http://playapi.mtgx.tv/v3/collections?device=mobile&premium=open&country=se'
            break;
        case 2:
            url = 'http://playapi.mtgx.tv/v3/formats?device=mobile&premium=open&country=se&limit=500';
            break;
        }
        break;

    case "categoryDetail":
        url = extra.location.replace("https:", "http:");
        break;

    case "searchList":
        url = "http://playapi.mtgx.tv/v3/search?term=" + extra.query + "&device=mobile&premium=open&country=se&columns=formats,episodes,clips&with=format&limit=500";
        break;

    default:
        url = tag.replace("https:", "http:");
        break;
    }
    return Viasat.addChannel(url)
};

Viasat.decodeMain = function(data, extra) {

    extra.reverse=true;
    Viasat.decodeShows(data, extra);
}

Viasat.decodeSection = function(data, extra) {
    Viasat.decode(data, extra);
}

Viasat.decodeCategories = function(data, extra) {
    try {
        var Name;
	var Link;
	var ImgLink;

        if (!extra.url.match(/(categories|collections)/)) {
            return Viasat.decodeShows(data,extra);
        }

        data = JSON.parse(data.responseText);
        if (data._embedded.categories)
            data = data._embedded.categories;
        else 
            data = data._embedded.collections;

        for (var k=0; k < data.length; k++) {

            if (data[k].name) {
                Name = data[k].name;
	        Link = data[k]._links.formats.href
                if (!Link.match(/device=mobile/))
                    Link = Link + "&device=mobile";
            } else {
                Name = data[k].title;
	        Link = data[k]._links.self.href
            }
            if (Viasat.isSubChannelSet()) {
                if (JSON.parse(httpRequest(Viasat.addChannel(Link),{sync:true}).data).count.total_items == 0)
                    continue;
            }
	    ImgLink  = Viasat.fixThumb(data[k]._links.image.href);

            toHtml({name:Name,
                    link:Link + "&limit=500",
                    link_prefix:'<a href="categoryDetail.html?category=',
                    thumb:ImgLink,
                    largeThumb:Viasat.fixThumb(ImgLink, VIASAT_DETAILS_IMG_SIZE)
                   });
	}
	data = null;
    } catch(err) {
        Log("Viasat.decodeCategories Exception:" + err.message + " data[" + k + "]:" + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Viasat.decodeCategoryDetail = function(data, extra) {
    Viasat.decodeShows(data, extra);
}

Viasat.decodeLive = function(data, extra) {

    try {
        var result = [];
        var oldId = (Viasat.isSubChannelSet()) ? Viasat.channels[Viasat.channel_idx].id : null;

        data = JSON.parse(data.responseText);
        data = data._embedded.channels
        Viasat.channels = [];

        for (var k=0; k < data.length; k++) {
            Viasat.channels.push({name:data[k].name.trim(), 
                                  id:data[k].id,
                                  thumb:Viasat.fixThumb(data[k].image)
                                 });
        }
        Viasat.channels.sort(function(a, b){
            var NumberA = a.name.replace(/[^0-9]*/g, "");
            var NumberB = b.name.replace(/[^0-9]*/g, "");
            if (NumberA.length > 0 && NumberB.length > 0) {
                return +NumberA - +NumberB
            } else if (NumberA.length > 0) {
                return -1
            } else if (NumberB.length > 0) {
                return 1 
            } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1
            } else {
                return 1
            }
        });
        
        for (var k=0; k < Viasat.channels.length; k++) {
            if (oldId != null) {
                if (getItemCounter() == 0)
                    Viasat.channelToHtml("Viasat", "reset");
                if (Viasat.channels[k].id == oldId) {
                    Viasat.channel_idx = k;
                    continue;
                }
            }
            Viasat.channelToHtml(Viasat.channels[k].name, 
                                 k,
                                 Viasat.channels[k].thumb
                                );
        }
        data = html = result = null;
    } catch(err) {
        Log("Viasat.decodeChannels Exception:" + err.message + " data[" + k + "]:" + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Viasat.decodeShowList = function(data, extra) {
    Viasat.decode(data, extra);
}

Viasat.decodeSearchList = function(data, extra) {
    if (extra.query.length > 1) {
        var orgCbComplete = extra.cbComplete
        var newCbComplete = function() {
            extra.cbComplete  = orgCbComplete;
            extra.is_clips    = true;
            Viasat.decode(data,extra)
        };
        extra.cbComplete = function() {
            extra.show_filter = Viasat.show_ids;
            extra.cbComplete=newCbComplete;
            Viasat.decode(data,extra)
        }
    }
    Viasat.decodeShows(data,extra);
}

Viasat.addChannel = function(url) {
    if (Viasat.isSubChannelSet())
        return url + "&channel=" + Viasat.channels[Viasat.channel_idx].id;
    return url;
};

Viasat.getNextCategory = function() {
    if (Viasat.channel_idx == null)
        return getNextIndexLocation(2);
    else
        return getNextIndexLocation(2, 1);
}

Viasat.getCategoryIndex = function () {
    if (Viasat.channel_idx == null)
        return getIndex(2);
    else
        return getIndex(2, 1);
};

Viasat.getHeaderPrefix = function(MainName) {
    if (!MainName && Viasat.isSubChannelSet())
        return Viasat.channels[Viasat.channel_idx].name;
    return "Viasat";
}

Viasat.getLiveTitle = function() {
    return 'Kanaler';
}

Viasat.keyRed = function() {
    if ($("#a-button").text().indexOf("Pop") != -1) {
	setLocation('index.html');
    } else if ($("#a-button").text().indexOf("lip") != -1) {
	setLocation('LatestClips.html');
    } else {
	setLocation('Latest.html');
    }
}

Viasat.keyGreen = function() {
    if ($("#b-button").text().indexOf("ateg") != -1)
	setLocation('categories.html');
    else
        setLocation(Viasat.getNextCategory())
}

Viasat.getAButtonText = function(language) 
{
    var loc = getIndexLocation();
    if (loc.match(/index\.html/)){
        if(language == 'English'){
	    return 'Latest';
        } else {
	    return 'Senaste';
        }
    } else if (loc.match(/Latest\.html/)) {
        if(language == 'English'){
	    return 'Latest Clips';
        } else {
	    return 'Senaste Klipp';
        }
    } else {
        // Use Default
        return null;
    }
};

Viasat.getBButtonText = function(language) {
    if (getIndexLocation().match(/categories\.html/)) {
        switch (Viasat.getCategoryIndex().next) {
        case 0:
            // Use Default
            return null;
        case 1:
            if (language == "Swedish")
                return "Utvalt";
            else
                return "Collections";
            break
        case 2:
            if (language == "Swedish")
                return "Alla Program";
            else
                return "All Shows";
            break;
        }
    } else
        return null
};

Viasat.getCButtonText = function (language) {
    if(language == 'English')
	return 'Channels';
    else
        return 'Kanaler';
};

Viasat.decode = function(data, extra) {
    try {
        var Name;
        var Duration;
        var Link;
        var Description;
        var ImgLink;
        var next = null;
        var clipsUrl = null;
        var seasonUrl = null;
        var AirDate;
        var Episode=null;
        var Season=null;
        var Show=null;
        var ShowId=null;

        if (!extra.is_next)
            Viasat.result = [];

        if (extra.url && (extra.url.cached || extra.url.match(/\/seasons/))) {
            return Viasat.decodeShows(data, extra);
        }
        if (data.responseText)
            data = data.responseText
        data = JSON.parse(data);
        if (data._links && data._links.next)
            next = data._links.next.href
        else 
            next = null;

        if (extra.strip_show && !extra.is_clips && data._links && data._links.self) {
            clipsUrl = data._links.self.href.replace("type=program", "type=clip").replace(/&page=[^&]+/,"");
        }

        if (data._embedded.sections)
            data = data._embedded.sections[0]._embedded.videos;
        else if (data._embedded.videos)
            data = data._embedded.videos;
        else if (!extra.is_clips && data._embedded.episodes)
            data = data._embedded.episodes;
        else if (extra.is_clips && data._embedded.clips)
            data = data._embedded.clips;
        else
            data = data._embedded.items;
        for (var k=0; data && k < data.length; k++) {
            Name = data[k].title.trim();
            if (data[k].format_title) {
                Show   = data[k].format_title.trim();
                ShowId = data[k].format_id;
            } else {
                Show   = data[k]._embedded.format.title.trim();
                ShowId = data[k]._embedded.format.id;
            }
            if (ShowId && extra.show_filter && extra.show_filter.indexOf(ShowId)!=-1)
                continue;
            
            if (extra.strip_show && Show != Name) {
                Name = Name.replace(Show,"").replace(/^[,. :\-]*/,"").replace(/[,. :\-]+$/,"").trim();
                Name = Name.replace(/^./,Name[0].toUpperCase());
                Name = Name.replace(/^([Ss][0-9]+)?[Ee][0]*([0-9]+)$/,"Avsnitt $2")
            } else
                Show = null;

            ImgLink = Viasat.fixThumb(data[k]._links.image.href);
            if (!data[k]._links.stream && data[k]._links.seasons) {
                Viasat.result.push({name:Name, link:data[k]._links.seasons.href, thumb:ImgLink});
                continue;
            }
            Duration = data[k].duration;
            Description = (data[k].summary) ? data[k].summary.trim() : "";
            if (data[k]._links.stream)
                Link = data[k]._links.stream.href;
            else
                Link = "http://playapi.mtgx.tv/v3/videos/stream/" + data[k].id;

            AirDate = Viasat.getAirDate(data[k]);
            if (data[k].format_position) {
                Episode = data[k].format_position.episode;
                Season  = data[k].format_position.season;
            } else if (data[k].season_number) {
                Episode = data[k].episode_number;
                Season  = +data[k].season_number;
            } else {
                Season = Episode = undefined
            }
            if (clipsUrl && !seasonUrl && data[k]._links.season)
                seasonUrl = data[k]._links.season.href;
            Viasat.result.push({name:Name, 
                                show:Show,
                                season:Season,
                                episode:Episode,
                                link:Link, 
                                thumb:ImgLink, 
                                duration:Duration, 
                                description:Description,
                                airDate:AirDate,
                                link_prefix:'<a href="details.html?ilink='
                               }
                              );
        }
        if (next) {
            data = null;
            return Viasat.requestNextPage(next, function(status, nextData) {
                extra.is_next = true;
                Viasat.decode(nextData, extra);
            });
        }
        
        if (extra.strip_show) {
            Viasat.result.sort(function(a, b){
                if (a.episode == b.episode) {
                    if (a.airDate > b.airDate)
                        return -1
                    else
                        return 1
                } else if (!b.episode || +a.episode > +b.episode) {
                    return -1
                } else {
                    return 1
                }
            })
        };

        for (var k=0; k < Viasat.result.length; k++) {
            if (!Viasat.result[k].link_prefix) {
                showToHtml(Viasat.result[k].name,
                           Viasat.result[k].thumb,
                           Viasat.result[k].link
                          );
            } else {
                
                toHtml({name:Viasat.result[k].name,
                        duration:Viasat.result[k].duration,
                        is_live:false,
                        is_channel:false,
                        is_running:null,
                        link:Viasat.result[k].link,
                        link_prefix:Viasat.result[k].link_prefix,
                        description:Viasat.result[k].description,
                        thumb:Viasat.result[k].thumb,
                        show:Viasat.result[k].show,
                        season:Viasat.result[k].season,
                        episode:Viasat.result[k].episode
                       });
            }
	}
        if (clipsUrl) {
            data = JSON.parse(httpRequest(clipsUrl,{sync:true}).data);
            var clipsThumb = null;
            if (data.count.total_items > 0) {
                if (seasonUrl) {
                    data = JSON.parse(httpRequest(seasonUrl,{sync:true}).data);
                    if (data._links && data._links.image)
                        clipsThumb = Viasat.fixThumb(data._links.image.href); 
                }
                clipToHtml(clipsThumb, clipsUrl);
            }
        };
        data = null;
        Viasat.result = [];
    } catch(err) {
        if (data)
            Log("Viasat.decode Exception:" + err.message + " data[" + k + "]:" + JSON.stringify(data[k]));
        else
            Log("Viasat.decode Exception:" + err.message);
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Viasat.getAirDate = function(data) {
    try {
        return timeToDate(data.broadcasts[0].air_at);
    } catch (err) {
        if (data.publish_at)
            return timeToDate(data.publish_at);
        else
            return timeToDate(data.publish_date);
    }
}

Viasat.channelToHtml = function(name, idx, thumb) {
    toHtml({name:name,
            duration:"",
            is_live:false,
            is_channel:false,
            is_running:null,
            link:idx,
            link_prefix:'<a href="index.html?viasat_channel=',
            description:"",
            thumb:thumb
           });
};

Viasat.decodeShows = function(data, extra) {
    try {
        var Name;
        var Link;
        var ImgLink;
        var next = nextLast = null;
        var checkSeasons=false;
        var LinkPrefix = null;
        var query = null;
        var json = null;
        var prevResult = []

        if (!extra.is_next && !extra.is_prev) {
            Viasat.result = [];
            Viasat.show_ids = [];
        } else if (extra.is_prev) {
            prevResult = Viasat.result
            Viasat.result = []
        }

        if (data && data.responseText)
            data = data.responseText;

        json = JSON.parse(data);
        if (!extra.reverse && json._links && json._links.next)
            next = json._links.next.href
        else 
            next = null;

        if (+json.count.total_pages > 1) {
            nextLast = +json.count.total_pages - 1
            nextLast = extra.url.replace(/page=[0-9]+/, "page="+nextLast)
        }
        else 
            nextLast = null;

        if (json.data && json.data.formats) {
            json = json.data.formats;
        } else if (json._embedded.formats) {
            json = json._embedded.formats;
        } else if (json._embedded.seasons) {
            json = json._embedded.seasons;
            checkSeasons = true;
        } else {
            if (json._embedded.items[0].type && json._embedded.items[0].type == "program") {
                return Viasat.decode(data,extra);
            }
            json = json._embedded.items;
        }

        for (var k=0; k < json.length; k++) {
            LinkPrefix = null;
            Name = json[k].title;
            if (json[k]._links.videos && 
                (!json[k]._links.seasons ||
                 (json[k].latest_video && 
                  json[k].latest_video.format_position && 
                  !json[k].latest_video.format_position.is_episodic &&
                  json[k]._links.videos)
                )
               ) {
                Link = json[k]._links.videos.href + "&type=program"; 
            } else if (json[k]._links.seasons)
	        Link = json[k]._links.seasons.href;
            else
                Link = "http://playapi.mtgx.tv/v3/seasons?format=" + json[k].id;
            if (json[k]._links.image) {
                ImgLink = Viasat.fixThumb(json[k]._links.image.href);
            } else {
                ImgLink = null;
            }
            if (checkSeasons) {
                if (JSON.parse(httpRequest(Link,{sync:true}).data).count.total_items == 0)
                    continue;
                LinkPrefix = makeSeasonLinkPrefix(Name, json[k].format_position.season);
            }
            if (extra.query)
                Viasat.show_ids.push(json[k].id);
            Viasat.result.push({name:Name, link:Link, thumb:ImgLink, link_prefix:LinkPrefix});
        }
        json = null;
        if (next) {
            data = null;
            return Viasat.requestNextPage(next, 
                                          function(status, nextData) {
                                              extra.is_next = true;
                                              Viasat.decodeShows(nextData, extra);
                                          },
                                          extra.no_abort
                                         );
        }

        if (extra.reverse) {
            Viasat.result = Viasat.result.concat(prevResult)
            if (Viasat.result.length < 50 && nextLast)
                return Viasat.requestNextPage(nextLast, 
                                              function(status, nextData) {
                                                  extra.is_prev = true;
                                                  Viasat.decodeShows(nextData, extra);
                                              },
                                              extra.no_abort
                                             );
            else {
                Viasat.result.reverse();
            }
        }
        else
            Viasat.result.sort(function(a, b) {
                var name_a = (checkSeasons) ? Number(a.name.replace(/[^0-9]+/, "")) : a.name.toLowerCase();
                var name_b = (checkSeasons) ? Number(b.name.replace(/[^0-9]+/, "")) : b.name.toLowerCase();
                return (name_a > name_b) ? 1 : -1;
            });

        if (extra.query && extra.query.length == 1)
            query = new RegExp("^" + extra.query, 'i')

        data = null;

        if (!extra.query && extra.url && !extra.url.cached && extra.url.match(/\/seasons/)) {
            if (Viasat.result.length == 1) {
                callTheOnlySeason(Viasat.result[0].name, Viasat.result[0].link, extra.loc);
                Viasat.result = [];
                return;
            }
            Viasat.result.reverse();
        }

        for (var k=0; k < Viasat.result.length; k++) {
            // Check if searching
            if (query && !query.test(Viasat.result[k].name))
                continue;

            showToHtml(Viasat.result[k].name,
                       Viasat.result[k].thumb,
                       Viasat.result[k].link,
                       Viasat.result[k].link_prefix
                      );
        }
        Viasat.result = [];
    } catch(err) {
        if (json)
            Log("Viasat.decodeShows Exception:" + err.message + " json[" + k + "]:" + JSON.stringify(json[k]));
        else 
            Log("Viasat.decodeShows Exception:" + err.message);
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Viasat.getDetailsData = function(url, data) {

    if (url.match(/(\/formats\/|\?format=|type=clip)/))
        return Viasat.getShowData(url,data);

    var Name="";
    var Title = Name;
    var DetailsImgLink="";
    var AirDate="";
    var VideoLength = "";
    var AvailDate=null;
    var Description="";
    var Show=null;
    var Season=null;
    var Episode=null;
    try {

        data = JSON.parse(data.responseText);

        Name = data.title;
        Title = Name;
	DetailsImgLink = Viasat.fixThumb(data._links.image.href, VIASAT_DETAILS_IMG_SIZE);
        AirDate = Viasat.getAirDate(data);
        if (data.unpublish_at || data.premium.time_left.days) {
            if (data.unpublish_at) {
                AvailDate = timeToDate(data.unpublish_at);
            } else if (data.premium.time_left.days) {
                var AvailDate = getCurrentDate();
                AvailDate.setDate(AvailDate.getDate() + data.premium.time_left.days);
                // AvailDate = dateToString(myDate,"-");
            }
            if (data.premium.time_left.days) {
                AvailDate = dateToFullString(AvailDate)
                AvailDate = AvailDate + " (" + data.premium.time_left.days + " dagar kvar)";
            }
        }
        VideoLength = dataLengthToVideoLength(null, data.duration);
        if (!data.summary.match(data.description))
	    Description = (data.description + ". " + data.summary).replace(/\.\./g,".");
        else
	    Description = data.summary;

        if (data._embedded && data._embedded.format) {
            Show = {name  : data._embedded.format.title,
                    url   : data._embedded.format._links.seasons.href.replace("https", "http"),
                    thumb : Viasat.fixThumb(data._embedded.format._links.image.href)
                   }
        }
        if (data.format_position) {
            Episode = data.format_position.episode;
            Season  = data.format_position.season;
        } else if (data.season_number) {
            Episode = data.episode_number;
            Season  = +data.season_number;
        }
    } catch(err) {
        Log("Viasat.getDetailsData Exception:" + err.message);
        Log("Name:" + Name);
        Log("AirDate:" + AirDate);
        Log("AvailDate:" + AvailDate);
        Log("VideoLength:" + VideoLength);
        Log("Description:" + Description);
        Log("DetailsImgLink:" + DetailsImgLink);
    }
    data = null;
    return {name          : Name,
            title         : Title,
            is_live       : false,
            air_date      : AirDate,
            avail_date    : AvailDate,
            start_time    : 0,
            duration      : VideoLength,
            description   : Description,
            not_available : false,
            thumb         : DetailsImgLink,
            season        : Season,
            episode       : Episode,
            episode_name  : Name,
            parent_show   : Show
    }
};

Viasat.getShowData = function(url, data) {

    var Name="";
    var DetailsImgLink="";
    var Description="";

    try {
        data = JSON.parse(data.responseText);
        if (url.match(/type=clip/)) {
            data = data._embedded.videos[0];
            Name = "Klipp";
        } else {
            Name = data.title;
            Description = data.summary;
        }
        DetailsImgLink = Viasat.fixThumb(data._links.image.href, VIASAT_DETAILS_IMG_SIZE);
    } catch(err) {
        Log("Viasat.getShowData exception:" + err.message);
        Log("Name:" + Name);
        Log("Description:" + Description);
        Log("DetailsImgLink:" + DetailsImgLink);
    }
    data = null;
    return {show          : true,
            name          : Name,
            description   : Description,
            genre         : "",
            thumb         : DetailsImgLink
           };
};

Viasat.getDetailsUrl = function(streamUrl) {
    return streamUrl.replace(/\/stream/, "").replace(/(seasons|videos)\?format=([0-9]+).*/, "formats/$2");
};

Viasat.getPlayUrl = function(orgStreamUrl) {
    var streamUrl = orgStreamUrl.replace(/videos\/([0-9]+)/, "videos/stream/$1");

    requestUrl(streamUrl,
               function(status, data)
               {
                   if (Player.checkPlayUrlStillValid(orgStreamUrl)) {
                       var stream
                       data = JSON.parse(data.responseText);
                       if (data.streams.hls)
                           stream = data.streams.hls;
                       else if (data.streams.high)
                           stream = data.streams.high;
                       else
                           stream = data.streams.medium;
                       data = JSON.parse(httpRequest(Viasat.getDetailsUrl(streamUrl),{sync:true}).data)
                       var srtUrls=[];
                       if (data.sami_path) srtUrls.push(data.sami_path); 
                       if (data.subtitles_for_hearing_impaired) srtUrls.push(data.subtitles_for_hearing_impaired);
                       if (data.subtitles_webvtt) srtUrls.push(data.subtitles_webvtt);
                       Resolution.getCorrectStream(stream, {list:srtUrls}, {useBitrates:true});
                   }
               });
}

Viasat.fixThumb = function(thumb, size) {
    if (!thumb)
        return thumb;

    if (!size)
        size = THUMB_WIDTH + "x" + THUMB_HEIGHT;
    thumb = thumb.replace(/(({size})|([0-9]+x[0-9]+))/, size);
    thumb = thumb.split(/(^.+\/)([^\/]+)$/);
    return thumb[1]+encodeURIComponent(thumb[2]);
}

Viasat.fetchSubtitles = function (subUrls, hlsSubs) {
    if (hlsSubs && hlsSubs.length > subUrls.list.length) {
        return Player.fetchHlsSubtitles(hlsSubs);
    } else if (subUrls.list.length == 0) {
        return;
    } else if (subUrls.list[0].match(/\.(web)?vtt/)) {
        return Player.fetchSubtitles(subUrls, hlsSubs)
    }
    var anyFailed = false
    httpLoop(subUrls.list,
             function(url, data, status) {
                 if (status != 200) {
                     Log("Viasat.fetchSubtitles sub failed: " + status);
                     data = ""
                     anyFailed = true;
                     return ""
                 } else {
                     return data
                 }
             },
             function(data) {
                 if (data.length > 0)
                     Viasat.parseSubtitles(data);
                 if (anyFailed && hlsSubs)
                     Player.fetchHlsSubtitles(hlsSubs)
             }
            );
};

Viasat.parseSubtitles = function (data) {

    var start,stop,text;
    data = data.split("SpotNumber");
    data.shift()
    subtitles = [];
    for (var i=0; i<data.length; i++) {
        
        start = data[i].match(/TimeIn="([^"]+)/)[1];
        stop  = data[i].match(/TimeOut="([^"]+)/)[1];
        text  = data[i].match(/">(.+)<\/Text/mg);
        for (var j=0; j<text.length; j++) {
            text[j] = text[j].match(/">(.+)<\/Text/)[1];
        }
        subtitles.push(
            {
                start: Player.srtTimeToMS(start.replace(/:([0-9]+)$/,",$1")),
                stop:  Player.srtTimeToMS(stop.replace(/:([0-9]+)$/,",$1")),
                text:  text.join("<br />").replace(/<br \/>$/g, "").replace(/([^.?!\-] )I([a-\xf6]+)/g, "$1l$2").replace(/([a-\xf6]+)I/g, "$1l")
            }
        )
    }
    subtitles.sort(function(a, b){return a.start - b.start});
    // for (var i = 0; i < 10 && i < subtitles.length; i++) {
    //     alert("start:" + subtitles[i].start + " stop:" + subtitles[i].stop + " text:" + subtitles[i].text);
    // }
};

Viasat.requestNextPage = function(url, callback, noAbort) {
    if (noAbort)
        httpRequest(url, {cb:callback})
    else
        requestUrl(url,callback,{cbError:callback});
}
