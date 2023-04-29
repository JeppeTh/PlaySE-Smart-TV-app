var Dplay = {
    is_logged_in:false,
    channel_idx:null,
    channels:[],
    all_shows:[],
    all_show_names:[],
    all_genres:[],
    show_names:[],
    result:[],
    play_args:{}
};

Dplay.resetSubChannel = function() {
    Dplay.channel_idx = null;
    Dplay.all_shows = [];
    Dplay.all_show_names = [];
    Dplay.all_genres = [];
    Dplay.reset();
};

Dplay.isSubChannelSet = function() {
    return Dplay.channel_idx != null;
};

Dplay.reset = function() {
    Dplay.show_names = [];
    Dplay.result = [];
};

Dplay.getUrl = function(tag, extra) {

    switch (tag) {
    case 'main':
        var newChannel = getLocation(extra.refresh).match(/dplay_channel=([0-9]+|reset)/);
        newChannel = (newChannel && newChannel.length > 0) ? newChannel[1] : null;
        if (newChannel && !extra.refresh)
            myHistory = [];
        if (newChannel && Dplay.channel_idx != newChannel) {
            Dplay.resetSubChannel();
            if (newChannel != 'reset')
                Dplay.channel_idx = newChannel;
            // Force new channel name
            Header.display(document.title);
        }
        Dplay.preFetchAllShows();
        if (!newChannel || newChannel == 'reset')
            return 'https://disco-api.dplay.se/cms/collections/home-page?include=default';
        else
            return Dplay.getPopularUrl();
        break;

    case 'section':
        switch (extra.location) {

        case 'Latest.html':
            return Dplay.makeApiUrl('/videos', '&include=images%2Cshow&filter%5BvideoType%5D=EPISODE&page%5Bsize%5D=75&sort=-publishStart');
            break;
        }
        break;

    case 'categories':
        if (Dplay.getCategoryIndex().current==1) {
            if (Dplay.all_shows.length == 0)
                return Dplay.getAllShowsUrl();
            else
                return {cached:true};
        } else {
            return Dplay.makeApiUrl('/genres', '&include=images');
        }
        break;

    case 'categoryDetail':
        return {cached:true,url:extra.location};

    case 'live':
        return Dplay.makeApiUrl('/channels', '&include=images');
        break;

    case 'searchList':
        if (Dplay.all_show_names.length == 0)
            return Dplay.getAllShowsUrl();
        else if (extra.query.length > 1)
            return Dplay.makeApiUrl('/shows', '&include=images&page%5Bsize%5D=100&query=' + extra.query);
        else
            return {cached:true};
        break;

    default:
        return tag;
    }
};

Dplay.getPopularUrl = function() {
    return Dplay.makeApiUrl('/shows', '&include=images&page%5Bsize%5D=50&sort=views.lastMonth');
};

Dplay.login = function(callback) {
    Dplay.is_logged_in = false;
    httpRequest('https://disco-api.dplay.se/token?realm=dplayse&deviceId=deviceId&shortlived=true',
                {cb:function(status, data, xhr) {
                    Log(xhr.getAllResponseHeaders().split(/\r?\n/));
                    Log(xhr.getResponseHeader('set_cookie0'));
                    Log(xhr.getResponseHeader('set-cookie'));
                    Dplay.is_logged_in = true;
                    if (callback)
                        callback();
                },
                 sync:!callback,
                 headers:Dplay.getHeaders()
                }
               );
};

Dplay.isLoggedIn = function() {
    return Dplay.is_logged_in;
};

Dplay.getHeaders = function() {
    var headers = [{key:'user-agent', value:'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36'}];

    // if (Dplay.cookie)
    //     headers.push({key:'cookie', value:Dplay.cookie})
    return headers;
};

Dplay.decodeMain = function(data, extra) {
    Dplay.reset();
    data = JSON.parse(data.responseText);
    var RecommendedCollection = [];
    var Recommended = [];
    var RecommendedShowIds = [];
    if (data.data.relationships) {
        Recommended = data.data.relationships.items.data[0].id;

        Recommended = Dplay.findIncludedId(data, Recommended).relationships.collection.data.id;
        Recommended = Dplay.findIncludedId(data, Recommended).relationships.items.data;
        RecommendedCollection = Dplay.decodeCollection(data, Recommended, []);
        Recommended = [];
        for (var i=0,showId=0; i < RecommendedCollection.length; i++) {
            showId = RecommendedCollection[i].show_id;
            if (!showId) showId = RecommendedCollection[i].id;
            if (RecommendedShowIds.indexOf(showId) != -1)
                // duplicate
                continue;
            Recommended.push(Dplay.findIncludedId(data, RecommendedCollection[i].id));
            RecommendedShowIds.push(showId);
        }
        data.data = Recommended;
        Dplay.decodeShows(data,extra);
        // Need to save these since preFetch may interfere
        Recommended = Dplay.result;
    }
    data = null;
    extra.url = Dplay.getPopularUrl();
    extra.cbComplete = null;
    extra.recommended_ids = RecommendedShowIds;
    requestUrl(extra.url,
               function(status, data) {
                   Dplay.result = Recommended;
                   Dplay.decode(data, extra);
               },
               {callLoadFinished:true,
                refresh:extra.refresh
               }
              );
};

Dplay.decodeSection = function(data, extra) {
    Dplay.decode(data, extra);
};

Dplay.decodeCategories = function(data, extra, allFetched) {

    if (extra.url.cached || !extra.url.match(/\/genres/)) {
        Dplay.handleAllShows(data, extra);
        data = null;
    } else if (Dplay.all_shows.length == 0 && !allFetched) {
        // I don't understand JS it seems. Seems reference object is re-used
        // somehow. I.e. when callback is invoked data contains the data
        // received in getAllShowsUrl...
        var responseText = data.responseText;
        return Dplay.getAllShows(function(){Dplay.decodeCategories({responseText:responseText}, extra, true);}, null, true);
        data = null;
    } else {
        try {
            var genres = [];
            data = JSON.parse(data.responseText).data;
            for (var k=0; k < data.length; k++) {
                if (data[k].attributes.name.trim().match(/gratis/i))
                    continue;
                if (Dplay.all_genres.indexOf(data[k].id) == -1)
                    // No shows
                    continue;
                genres.push({name:data[k].attributes.name.trim(),
                             link:Dplay.getAllShowsUrl() + '?filter%5Bgenre.id%5D=' + data[k].id
                            });
	    }
            genres.sort(function(a, b) {
                if (a.name.toLowerCase() < b.name.toLowerCase()) {
                    return -1;
                } else {
                    return 1;
                }
            });
	    data = null;

            for (var i=0; i < genres.length; i++)
                categoryToHtml(genres[i].name, null, null, genres[i].link);

            if (extra.cbComplete)
                extra.cbComplete();

        } catch(err) {
            Log('Dplay.decodeCategories Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
        }
    }
};

Dplay.decodeCategoryDetail = function(data, extra) {
    Dplay.getAllShows(extra.cbComplete, extra.url.url);
};

Dplay.decodeLive = function(data, extra) {

    var Includes=null;
    var oldId = (Dplay.isSubChannelSet()) ? Dplay.channels[Dplay.channel_idx].id : null;
    var Name;
    Dplay.channels = [];
    data = JSON.parse(data.responseText);
    Includes = Dplay.decodeIncludes(data);
    data = data.data;
    for (var k=0; k < data.length; k++) {
        Name = data[k].attributes.name.trim();
        Dplay.channels.push({name:Name, id:data[k].id});
        if (oldId != null) {
            if (k == 0)
                Dplay.channelToHtml('DPLAY', 'reset', null);
            if (oldId == data[k].id) {
                Dplay.channel_idx = k;
                continue;
            }
        }
        Dplay.channelToHtml(Name, k, Dplay.findImage(data[k], Includes));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Dplay.decodeShowList = function(data, extra) {
    Dplay.decode(data, extra);
};

Dplay.decodeSearchList = function(data, extra) {
    Dplay.reset();
    // At least in old Dplay api Search result for shows also contains 'unplayable' shows,
    // so first fetch all shows and then we filter from that.
    if (Dplay.all_show_names.length == 0) {
        extra.only_save = true;
        Dplay.handleAllShows(data, extra);
        extra.url = Dplay.getUrl('searchList', extra),
        requestUrl(extra.url,
                   function(status, data) {
                       Dplay.decodeSearchList(data, extra);
                       data = null;
                   },
                   {cbError:extra.cbComplete,
                    headers:Dplay.getHeaders()
                   }
                  );
    } else {
        if (extra.query.length > 1) {
            data = JSON.parse(data.responseText);
            Dplay.decodeShows(data, extra);
            data = null;
            extra.url = extra.url.replace(/\/shows/, '/videos').replace('=images','=images%2Cshow');
            Dplay.searchVideos(extra);
        } else {
            var queryReqexp = (extra.query && extra.query.length == 1) ? new RegExp('^' + extra.query, 'i') : null;
            Dplay.result = [];
            for (var k=0; k < Dplay.all_shows.length; k++) {
                if (!queryReqexp.test(Dplay.all_shows[k].name))
                    continue;
                Dplay.result.push(Dplay.all_shows[k]);
            }
            Dplay.finishSearch(extra.cbComplete);
        }
    }
};

Dplay.searchVideos = function(extra) {
    requestUrl(extra.url,
               function(status, data) {
                   var NextPage = Dplay.decodeSearchHits(data, extra),
                   data = null;
                   if (NextPage) {
                       extra.url = NextPage;
                       Dplay.searchVideos(extra);
                   } else
                       Dplay.finishSearch(extra.cbComplete);
               },
               {cbError:extra.cbComplete,
                headers:Dplay.getHeaders()
               }
              );
};

// TODO - merge handleAllShows and getAllShows
Dplay.handleAllShows = function(data, extra, nextPage) {

    Dplay.reset();

    if (Dplay.all_shows.length == 0 || nextPage) {
        extra.all_shows = true;
        var cbComplete = extra.cbComplete;
        extra.cbComplete = null;
        nextPage = Dplay.decode(data, extra);
        extra.cbComplete = cbComplete;
        data = null;
        return nextPage;
    } else if (!extra.only_save) {
        Dplay.result = Dplay.all_shows;
        Dplay.resultToHtml();
        if (extra.cbComplete)
            extra.cbComplete();
    }
    return null;
};

Dplay.getAllShows = function(completeFun, url, onlySave, nextPage) {
    Dplay.reset();
    if (Dplay.all_shows.length == 0 || nextPage) {
        url = (nextPage) ? nextPage : Dplay.getAllShowsUrl();
        requestUrl(url,
                   function(status, data) {
                       nextPage = Dplay.decode(data, {all_shows:true,url:url,only_save:onlySave});
                       data = null;
                       if (nextPage)
                           Dplay.getAllShows(completeFun, url, onlySave, nextPage);
                   },
                   {cbComplete:function(){if (!nextPage && completeFun) completeFun();}}
                  );
    } else {
        if (!onlySave) {
            var genre = (url) ? url.match(/genre.id%5D=([0-9]+)/) : null;
            genre = (genre) ? genre[1] : null;
            Dplay.result = Dplay.filterShows(Dplay.all_shows, genre);
            Dplay.resultToHtml();
        }
        if (completeFun)
            completeFun();
    }
};

Dplay.preFetchAllShows = function(nextPage) {
    if (Dplay.all_shows.length != 0 && !nextPage)
        return;
    var extra = {only_save:true,
                 all_shows:true,
                 url      :(nextPage) ? nextPage : Dplay.getAllShowsUrl()
                };
    httpRequest(extra.url,
                {cb:function(status, text) {
                    nextPage = Dplay.handleAllShows({responseText:text}, extra, nextPage);
                    if (nextPage)
                        Dplay.preFetchAllShows(nextPage);
                },
                 headers:Dplay.getHeaders()
                }
               );
};

Dplay.getAllShowsUrl = function() {
    return Dplay.makeApiUrl('/shows', '&include=images%2Cgenres');
};

Dplay.filterShows = function(shows, genre) {
    if (!genre)
        return shows;
    var result = [];
    for (var k=0; k < shows.length; k++) {
        if (shows[k].genres.indexOf(genre) > -1)
            result.push(shows[k]);
    }
    return result;
};

Dplay.makeApiUrl = function(path, extra) {

    var channel = (Dplay.channel_idx) ? Dplay.channels[Dplay.channel_idx].id : null;
    channel = (!path.match(/\/channels/) && channel) ? '&filter%5BprimaryChannel.id%5D=' + channel : '';
    extra = (extra) ? extra : '';

    return  'https://disco-api.dplay.se/content' + path + '?page%5Bsize%5D=100&page%5Bnumber%5D=1' + channel + extra;
};

Dplay.makeShowUrl = function(id) {
    return Dplay.makeApiUrl('/shows/' + id, '&include=images%2Cseasons%2Cgenres');
};

Dplay.getPrefix = function(channel_idx) {
    var Name = channel;
    if (channel_idx)
        Name = Dplay.channels[channel_idx].prefix;
    return 'http://www.' + Name + 'play.se/';
};

Dplay.addChannel = function(url) {
    if (Dplay.isSubChannelSet())
        return url + '&channel=' + Dplay.channels[Dplay.channel_idx].id;
    return url;
};

Dplay.finishSearch = function (completeFun) {
    Dplay.resultToHtml();
    if (completeFun)
        completeFun();
};

Dplay.getNextCategory = function() {
    return getNextIndexLocation(1);
};

Dplay.getCategoryIndex = function () {
    return getIndex(1);
};

Dplay.getHeaderPrefix = function(MainName) {
    if (MainName || !Dplay.channel_idx)
        return 'DPLAY';
    else {
        return Dplay.channels[Dplay.channel_idx].name;
    }
};

Dplay.keyRed = function() {
    if ($('#a-button').text().indexOf('Pop') != -1) {
	setLocation('index.html');
    } else {
	setLocation('Latest.html');
    }
};

Dplay.keyGreen = function() {
    if ($('#b-button').text().indexOf('ateg') != -1)
	setLocation('categories.html');
    else
        setLocation(Dplay.getNextCategory());
};

Dplay.getSectionTitle = function(location) {
    return 'Senaste';
};

Dplay.getCategoryTitle = function() {
    switch (Dplay.getCategoryIndex().current) {
    case 0:
        return 'Kategorier';
    case 1:
        return 'Alla Program';
    }
};

Dplay.getLiveTitle = function() {
    return 'Kanaler';
};

Dplay.getAButtonText = function(language) {
    var loc = getIndexLocation();
    if (loc.match(/index\.html/)) {
        if(language == 'English'){
	    return 'Latest';
        } else {
	    return 'Senaste';
        }
    } else {
        return null;
    }
};

Dplay.getBButtonText = function(language) {
    if (getIndexLocation().match(/categories\.html/)) {
        switch (Dplay.getCategoryIndex().next) {
        case 0:
            // Use Default
            return null;
        case 1:
            if (language == 'Swedish')
                return 'Alla Program';
            else
                return 'All Shows';
            break;
        }
    } else
        return null;
};

Dplay.getCButtonText = function (language) {
    if(language == 'English')
	return 'Channels';
    else
        return 'Kanaler';
};

Dplay.decodeSearchHits = function(data, extra) {
    try {
        var Name;
        var Duration;
        var Link;
        var NextPage = null;
        var Description;
        var ImgLink;
        var Background;
        var next = null;
        var AirDate;
        var Show = null;
        var Season = null;
        var Episode=null;
        var Includes = null;

        data = JSON.parse(data.responseText);
        Includes = Dplay.decodeIncludes(data);
        NextPage = Dplay.getNextPage(data, extra);

        data = data.data;
        for (var k=0; k < data.length; k++) {
            Show = Dplay.findShowName(data[k], Includes);
            Name = Dplay.determineEpisodeName(data[k], Show);
            if (!Dplay.isItemOk(Name, data[k]))
                continue;
            if (data[k].attributes.drmEnabled) {
                Log('DPLAY DRM??:' + Name);
                continue;
            }
            if (Show) {
                if (Dplay.show_names.indexOf(Show) != -1)
                    continue;
                Name = Show + ' - ' + Name;
            }

            Description = data[k].attributes.description;
            if (Description)
                Description.trim();
            Duration = Dplay.getDuration(data[k]);
            ImgLink = Dplay.findImage(data[k], Includes);
            Background = Dplay.findImage(data[k], Includes, BACKGROUND_THUMB_FACTOR);
            AirDate = Dplay.getAirDate(data[k]);
            Link = Dplay.makeApiUrl('/videos/' + data[k].id, '&include=genres%2Cimages%2Cshow%2Cshow.images');
            Season  = (data[k].attributes.seasonNumber) ? data[k].attributes.seasonNumber : null;
            Episode = data[k].attributes.episodeNumber;
            Dplay.result.push({name:Name,
                               show:Show,
                               season:Season,
                               episode:Episode,
                               episode:null,
                               duration:Duration,
                               link:Link,
                               thumb:ImgLink,
                               background:Background,
                               description:Description,
                               airDate:AirDate,
                               isFollowUp:false
                              }
                             );
            data[k] = null;
        }
        data = null;
        return NextPage;
    } catch(err) {
        Log('Dplay.decodeSearchHits Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
};

Dplay.decode = function(data, extra) {
    try {
        var Includes=null;
        var NextPage = null;

        if (!extra.recommended_ids)
            Dplay.reset();
        data = JSON.parse(data.responseText);
        if (data.data[0] && data.data[0].type == 'show') {
            NextPage = Dplay.decodeShows(data, extra);
        } else if (extra.url.match(/\/shows\/[0-9]+/))
            return Dplay.decodeSeason(extra, data);
        else {
            Includes = Dplay.decodeIncludes(data);
            data = data.data;
            for (var k=0; k < data.length; k++) {
                Dplay.decodeEpisode(data[k], Includes, extra);
                data[k] = null;
            }
        }
        data = null;
        if (extra.strip_show) {
            Dplay.result.sort(function(a, b){
                if (a.episode == b.episode) {
                    if (a.isFollowUp || a.airDate > b.airDate)
                        return -1;
                    else
                        return 1;
                } else if (!b.episode || +a.episode > +b.episode) {
                    return -1;
                } else {
                    return 1;
                }
            });
        }
        if (extra.only_save)
            Dplay.reset();
        else if (!NextPage)
            Dplay.resultToHtml();
        if (NextPage)
            return NextPage;
    } catch(err) {
        Log('Dplay.decode Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Dplay.decodeEpisode = function (data, includes, extra) {

    var Name;
    var Duration;
    var Link;
    var Description='';
    var ImgLink;
    var Background;
    var AirDate;
    var Show=null;
    var Season=null;
    var Episode=null;
    var IsLive=false;
    var IsUpcoming=false;
    var Start = null;

    Show = Dplay.findShowName(data, includes);
    Name = Dplay.determineEpisodeName(data, Show);
    Start = extra.strip_show && Dplay.getUpcomingDate(data);
    IsUpcoming = Start && Dplay.isFree(Name,data) && Dplay.isCorrectChannel(Name,data);
    if (!IsUpcoming && !Dplay.isItemOk(Name,data)) {
        return
    }
    // if (data.attributes.drmEnabled)
    //     continue;
    if (extra.strip_show && data.attributes.episodeNumber) {
        Description = data.attributes.name.trim();
        Name        = 'Avsnitt ' + data.attributes.episodeNumber;
    } else if (!extra.strip_show && Show){
        if (Name.indexOf(Show) == -1) {
            Name = Show + ' - ' + Name;
        }
        if (data.attributes.description)
            Description = data.attributes.description.trim();
    }
    if (Description == Name)
        Description = '';
    Duration = Dplay.getDuration(data);
    ImgLink = Dplay.findImage(data, includes);
    Background = Dplay.findImage(data, includes, BACKGROUND_THUMB_FACTOR);
    AirDate = Dplay.getAirDate(data);
    Link = Dplay.makeApiUrl('/videos/' + data.id, '&include=genres%2Cimages%2Cshow%2Cshow.images');
    Season  = (data.attributes.seasonNumber) ? data.attributes.seasonNumber : null;
    Episode = data.attributes.episodeNumber;
    IsLive = data.attributes.videoType.match(/LIVE/);
    Start = (IsLive) ? Dplay.getAirDate(data) : Start;
    Dplay.result.push(
        {name:Name,
         show:Show,
         season:Season,
         episode:Episode,
         link:Link,
         thumb:ImgLink,
         background:Background,
         duration:Duration,
         description:Description,
         airDate:AirDate,
         isFollowUp:data.attributes.videoType.match(/FOLLOWUP/),
         is_live : IsLive,
         start : Start,
         is_running : getCurrentDate() > Start,
         is_upcoming : IsUpcoming
        });
};

Dplay.decodeShows = function(data, extra) {
    try {
        var Link;
        var NextPage = Dplay.getNextPage(data, extra);
        var ImgLink;
        var showData;
        var Name;
        var Genres = [];
        var Includes = [];

        Includes = Dplay.decodeIncludes(data);
        data = data.data;
        for (var k=0; k < data.length; k++) {
            if (data[k].type != 'show') {
                // Can happen for recommended....
                Dplay.decodeEpisode(data[k], Includes, extra);
                continue;
            }
            Genres = [];
            showData = data[k];
            if (extra.recommended_ids)
                if (extra.recommended_ids.indexOf(showData.id) != -1)
                    continue;

            Name = showData.attributes.name.trim();
            if (!Dplay.isItemOk(Name, showData))
                continue;
            if (showData.attributes.video_count == 0) {
                Log(Name + ': No episodes');
                continue;
            }
            if (extra.query && Dplay.all_show_names.indexOf(Name) == -1) {
                // Not playable... Probably not applicable after DPLAY
                Log(Name +  ': queried show isn\'t playable.');
                continue;
            }
            if (showData.relationships.genres)
                for (var i=0; i < showData.relationships.genres.data.length; i++)
                    Genres.push(showData.relationships.genres.data[i].id);
            Link = Dplay.makeShowUrl(showData.id);
            ImgLink = Dplay.findImage(showData, Includes);
            Dplay.show_names.push(Name);
            Dplay.result.push({is_show:true, name:Name, thumb:ImgLink, link:Link, genres:Genres});
            data[k] = null;
        }
        if (extra.all_shows) {

            Dplay.all_show_names = Dplay.all_show_names.concat(Dplay.show_names);
            Dplay.all_shows      = Dplay.all_shows.concat(Dplay.result);
            // Save genres
            for (var genres, j=0; j < Dplay.all_shows.length; j++) {
                genres = Dplay.all_shows[j].genres;
                for (var l=0; l < genres.length; l++) {
                    if (Dplay.all_genres.indexOf(genres[l]) == -1)
                        Dplay.all_genres.push(genres[l]);
                }
            }

        }
        else
            NextPage = null;
        data = null;
        return NextPage;

    } catch(err) {
        Log('Dplay.decodeShows Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
};

Dplay.decodeSeason = function(extra, data) {
    try {
        var Name;
        var Link;
        var ImgLink;
        var seasons = [];
        var showId = extra.url.match(/\/shows\/([0-9]+)/)[1];
        var Includes = Dplay.decodeIncludes(data);

        for (var k=0; k < Includes.seasons.length; k++) {
            Link = Dplay.makeApiUrl('/videos', '&include=images%2Cshow%2Cshow.images' +
                                    '&filter%5Bshow.id%5D=' + showId +
                                    '&filter%5BseasonNumber%5D=' + Includes.seasons[k] +
                                    '&sort=episodeNumber');
            Name = 'Säsong ' + Includes.seasons[k];
            seasons.push({season:Includes.seasons[k], name:Name, link:Link});
        }
        ImgLink = Dplay.findImage(data.data, Includes);
        data = null;
        if (seasons.length == 1) {
            return callTheOnlySeason(seasons[0].name, seasons[0].link, extra.loc);
        } else if (seasons.length == 0) {
            extra.url = Dplay.makeApiUrl('/videos', '&include=images%2Cshow%2Cshow.images' +
                                         '&filter%5Bshow.id%5D='+showId);
            return requestUrl(extra.url,
                              function(status, data) {
                                  Dplay.decodeShowList(data, extra);
                              },
                              {cbError:extra.cbComplete,
                               headers:Dplay.getHeaders()
                              }
                             );
        }
        seasons.sort(function(a, b){
                if (a.season > b.season)
                    return -1;
                else
                    return 1;
        });

        for (var i=0; i < seasons.length; i++) {
            seasonToHtml(seasons[i].name, ImgLink, seasons[i].link, seasons[i].season);
        }

    } catch(err) {
        Log('Dplay.decodeSeason Exception:' + err.message);
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Dplay.channelToHtml = function(name, idx, thumb) {
    toHtml({name:name,
            duration:'',
            link:idx,
            link_prefix:'<a href="index.html?dplay_channel=',
            description:'',
            thumb:thumb
           });
};

Dplay.getDetailsData = function(url, data) {

    if (url.match(/\/shows/))
        return Dplay.getShowData(url,data);

    var Name='';
    var Title = Name;
    var DetailsImgLink='';
    var AirDate='';
    var AvailDate=null;
    var VideoLength = '';
    var Description='';
    var Show=null;
    var isLive = false;
    var Season = null;
    var Episode = null;
    var Includes = null;
    var IsUnavailable = false;
    try {
        data = JSON.parse(data.responseText);
        Includes = Dplay.decodeIncludes(data);
        data = data.data;
        Show = Dplay.findShow(data, Includes);
        Name = Dplay.determineEpisodeName(data, (Show)?Show.name:null);
        Title = (data.attributes.episodeNumber) ? 'Avsnitt ' + data.attributes.episodeNumber : Name;
        isLive = data.attributes.videoType.match(/LIVE/);
        if (Show)
            Title = Show.name + ' - ' + Title;
	DetailsImgLink = Dplay.findImage(data, Includes, DETAILS_THUMB_FACTOR);
        AirDate = Dplay.getAirDate(data);
        VideoLength = dataLengthToVideoLength(null, Dplay.getDuration(data));
        if (data.attributes.description)
	    Description = data.attributes.description.trim();
        AvailDate = Dplay.getAvailDate(data);
        IsUnavailable = !Dplay.isAvailable(data);

        if (Show && Dplay.isItemOk(Show.name, Show.includes)) {
            Show = {name  : Show.name,
                    url   : Dplay.makeShowUrl(data.relationships.show.data.id),
                    thumb : Dplay.findImage(Show.includes, Includes)
                   };
        }
        Season  = (data.attributes.seasonNumber) ? data.attributes.seasonNumber : null;
        Episode = data.attributes.episodeNumber;

    } catch(err) {
        Log('Dplay.getDetailsData Exception:' + err.message);
        Log('Name:' + Name);
        Log('AirDate:' + AirDate);
        Log('VideoLength:' + VideoLength);
        Log('Description:' + Description);
        Log('DetailsImgLink:' + DetailsImgLink);
    }
    data = null;
    return {name          : Name,
            title         : Title,
            is_live       : isLive,
            air_date      : AirDate,
            avail_date    : AvailDate,
            start         : AirDate,
            duration      : VideoLength,
            description   : Description,
            not_available : IsUnavailable,
            thumb         : DetailsImgLink,
            season        : Season,
            episode       : Episode,
            episode_name  : Name,
            parent_show   : Show
    };
};

Dplay.determineEpisodeName = function(data, show) {
    var Name = data.attributes.name.trim();
    if (data.relationships.show && data.attributes.episodeNumber &&
        (!show || show.indexOf(Name) != -1))
        Name = 'Avsnitt ' + data.attributes.episodeNumber;
    return Name;
};

Dplay.getShowData = function(url, data) {
    var Name='';
    var Genres = [];
    var DetailsImgLink='';
    var Description='';
    var Includes = null;

    try {
        data = JSON.parse(data.responseText);
        Includes = Dplay.decodeIncludes(data);
        data = data.data;
        Name = data.attributes.name.trim();
        DetailsImgLink = Dplay.findImage(data, Includes, DETAILS_THUMB_FACTOR);
        Description = data.attributes.description.trim();
        Genres = Dplay.findGenres(data, Includes);

    } catch(err) {
        Log('Dplay.getShowData exception:' + err.message);
        Log('Name:' + Name);
        Log('Genre:' + Genres);
        Log('Description:' + Description);
        Log('DetailsImgLink:' + DetailsImgLink);
    }
    data = null;
    return {show          : true,
            name          : Name,
            description   : Description,
            genre         : Genres,
            thumb         : DetailsImgLink
           };
};

Dplay.getDetailsUrl = function(streamUrl) {
    return streamUrl.replace(/\/seasons/, '');
};

Dplay.getPlayUrl = function(streamUrl, isLive, callback) {
    Dplay.play_args = {stream_url:streamUrl, is_live:isLive};
    var videoUrl = 'https://disco-api.dplay.se/playback/videoPlaybackInfo/' + streamUrl.match(/\/videos\/([0-9]+)/)[1];
    requestUrl(videoUrl,
               function(status, data) {
                   if (Player.checkPlayUrlStillValid(streamUrl)) {
                       data = JSON.parse(data.responseText).data.attributes;
                       data = data.streaming.hls.url;
                       Resolution.getCorrectStream(data, null, {useBitrates:true,isLive:isLive,cb:callback});
                   }
               },
               {headers:Dplay.getHeaders()}
              );
};

Dplay.refreshPlayUrl = function(callback) {
    Dplay.getPlayUrl(Dplay.play_args.stream_url,
                     Dplay.play_args.is_live,
                     callback
                    );
};

Dplay.fixThumb = function(thumb, factor) {
    if (thumb) {
        var height = (factor) ? Math.round(factor*THUMB_HEIGHT) : THUMB_HEIGHT;
        var width  = (factor) ? Math.round(factor*THUMB_WIDTH)  : THUMB_WIDTH;
        thumb = (thumb.match(/\?/)) ? thumb+'&' : thumb+'?';
        // thumb = thumb + 'f=jpg&p=true&h=' + height;
        thumb = thumb + 'f=jpg&p=true&w=' + width;
    }
    return thumb;
};

Dplay.isFree = function(Name, data) {
    var isPremium = false;
    if (data.relationships.contentPackages) {
        for (var k=0; k < data.relationships.contentPackages.data.length; k++) {
            switch (data.relationships.contentPackages.data[k].id) {
                case 'Free':
                return true;

                case 'Premium':
                isPremium = true;
                break;
            }
        }
        return !isPremium;
    } else {
        Log(Name + ': No package');
        return true;
    }

};

Dplay.isCorrectChannel = function(Name, data) {
    if (!Dplay.isSubChannelSet())
        return true;

    var channel_id = Dplay.channels[Dplay.channel_idx].id;

    if (data.show)
        data = data.show;
    if (data.home_channel)
        return data.home_channel.id == channel_id;
    else
        Log(Name + ': No home_channel');
    return true;
};

Dplay.isAvailable = function(data) {

    if (data.attributes &&
        data.attributes.availabilityWindows) {
        for (var i=0; i < data.attributes.availabilityWindows.length; i++) {
            if (data.attributes.availabilityWindows[i].package == 'Free') {
                if (data.attributes.availabilityWindows[i].playableStart) {
                    if (getCurrentDate() > timeToDate(data.attributes.availabilityWindows[i].playableStart)) {
                        if (data.attributes.availabilityWindows[i].playableEnd)
                            return getCurrentDate() < timeToDate(data.attributes.availabilityWindows[i].playableEnd);
                        return true;
                    }
                    else
                        return false;
                }
            }
        }
    // } else if (data.attributes && data.attributes.videoCount != undefined) {
    //     return data.attributes.videoCount > 0;
    }
    // if (data.attributes.videoType.match(/LIVE/)) {
    //     if (timeToDate(data.live.start) > getCurrentDate() ||
    //         getCurrentDate() > timeToDate(data.live.end)) {
    //         // Future/Ended live show
    //         return false;
    //     }
    // } else if (data.rights) {
    //     var start = (data.rights.advod) ? data.rights.advod.start : null;
    //     if (!start && data.rights.svod)
    //         start = data.rights.svod.start;
    //     if (start && timeToDate(start) > getCurrentDate()) {
    //         // Premium/Future episode
    //         alert('Skipping ' + data.show.title + ' ' + data.title)
    //         return false;
    //     }
    // }
    return true;
};

Dplay.isItemOk = function(Name, data, genre) {
    if (!Dplay.isFree(Name, data)) {
        // alert(JSON.stringify(data))
        // alert(Name + ': Premium');
        return false;
    }
    if (!Dplay.isCorrectChannel(Name, data)) {
        alert(Name + ': wrong channel');
        return false;
    }
    if (!Dplay.isAvailable(data)) {
        alert(Name + ': not yet available');
        return false;
    }
    return true;

};

Dplay.resultToHtml = function() {
    for (var k=0; k < Dplay.result.length; k++) {
        if (Dplay.result[k].is_show)
            showToHtml(Dplay.result[k].name,
                       Dplay.result[k].thumb,
                       Dplay.result[k].link
                      );
        else {
            Dplay.result[k].link_prefix = '<a href="details.html?ilink=',
            toHtml(Dplay.result[k]);
        }
    }
};

Dplay.decodeCollection = function(data, recommended, result) {
    for (var ShowId,Collection,i=0; i < recommended.length; i++) {
        Collection = Dplay.findIncludedId(data, recommended[i].id);
        if (Collection.relationships.show) {
            result.push({id:Collection.relationships.show.data.id, is_show:true});
        } else if (Collection.relationships.video) {
            ShowId = Dplay.findIncludedId(data, Collection.relationships.video.data.id).relationships.show.data.id;
            result.push({id:Collection.relationships.video.data.id, show_id:ShowId});
        } else if (Collection.relationships.collection) {
            Collection = Dplay.findIncludedId(data, Collection.relationships.collection.data.id);
            result = Dplay.decodeCollection(data,
                                            Collection.relationships.items.data,
                                            result
                                           );
        } else {
            for (var key in Collection.relationships)
                Log('Dplay.decodeCollection ignore:' + key);
        }
    }
    return result;
};

Dplay.findIncludedId = function(data, id) {
    for (var i=0; i < data.included.length; i++) {
        if (data.included[i].id == id) {
            return  data.included[i];
        }
    }
};

Dplay.decodeIncludes = function(data) {
    var Includes = {images:[], shows:[], seasons:[], genres:[]};
    for (var k=0; k < data.included.length; k++) {
        if (data.included[k].type == 'image' &&
            data.included[k].attributes.kind == 'default') {
            Includes.images.push({id:data.included[k].id, src:data.included[k].attributes.src});
        } else if (data.included[k].type == 'show') {
            Includes.shows[data.included[k].id] =
                {name:     data.included[k].attributes.name,
                 includes: data.included[k]
                };
        } else if (data.included[k].type == 'genre') {
            Includes.genres[data.included[k].id] = data.included[k].attributes.name;
        } else if (data.included[k].type == 'season') {
            if (data.included[k].attributes.videoCount > 0)
                Includes.seasons.push(data.included[k].attributes.seasonNumber);
        }
    }
    return Includes;
};

Dplay.findImage = function(data, includes, factor) {
    if (data.relationships &&
        data.relationships.images) {
        data = data.relationships.images.data;
        for (var i=0; i < data.length; i++) {
            for (var k=0; k < includes.images.length; k++) {
                if (includes.images[k].id == data[i].id)
                    return Dplay.fixThumb(includes.images[k].src, factor);
            }
        }
    }
    return null;
};

Dplay.findShow = function(data, includes) {
    return data.relationships &&
        data.relationships.show &&
        includes.shows[data.relationships.show.data.id];
};

Dplay.findShowName = function(data, includes) {
    var Show = Dplay.findShow(data, includes);
    if (Show)
        return Show.name;
    return null;
};

Dplay.findShowImage = function(data, includes) {
    var Show = Dplay.findShow(data, includes);
    if (Show)
        return Dplay.findImage(Show.includes, includes);
    return null;
};

Dplay.findGenres = function(data, includes) {
    var Genres = [];
    if (data.relationships &&
        data.relationships.genres) {
        data = data.relationships.genres.data;
        for (var i=0; i < data.length; i++) {
            if (includes.genres[data[i].id])
                Genres.push(includes.genres[data[i].id]);
        }
    }
    return Genres.join('/');

    var Show = Dplay.findShow(data, includes);
    if (Show)
        return Show.name;
    return null;
};

Dplay.getDuration = function(data) {
    var Duration = data.attributes.videoDuration;
    if (Duration)
        return Math.floor(Duration/1000);
    else {
        data = data.attributes.availabilityWindows;
        for (var i=0; i < data.length; i++) {
            if (data[i].package == 'Free' && data[i].playableEnd)
                return (timeToDate(data[i].playableEnd)-timeToDate(data[i].playableStart))/1000;
        }
    }
    return null;
};

Dplay.getAvailDate = function(data) {
    data = data.attributes.availabilityWindows;
    for (var i=0; i < data.length; i++) {
        if (data[i].package == 'Free' && data[i].playableEnd)
            return timeToDate(data[i].playableEnd);
    }
    return null;
};

Dplay.getAirDate = function(data) {
    return timeToDate(Dplay.getMinDate(data.attributes.airDate, Dplay.getPlayableStart(data)));
};

Dplay.getPlayableStart = function(data) {
    if (data.attributes.availabilityWindows) {
        for (var i=0; i < data.attributes.availabilityWindows.length; i++) {
            if (data.attributes.availabilityWindows[i].package == 'Free' &&
                data.attributes.availabilityWindows[i].playableStart) {
                return data.attributes.availabilityWindows[i].playableStart;
                PlayableDate = timeToDate(data.attributes.availabilityWindows[i].playableStart);
                return (getCurrentDate() < PlayableDate) && PlayableDate;
            }
        }
    }
    return null;
};

Dplay.getUpcomingDate = function(data) {
    var PlayableDate = Dplay.getPlayableStart(data);
    PlayableDate = PlayableDate && timeToDate(PlayableDate);
    return (getCurrentDate() < PlayableDate) && PlayableDate;
};

Dplay.getMinDate = function (a, b) {
    if (!a) return b;
    if (!b) return a;
    if (timeToDate(a) < timeToDate(b))
        return a;
    return b;
};

Dplay.getNextPage = function(data, extra) {
    var ThisPage = extra.url.match(/&page%5Bnumber%5D=([0-9]+)/);
    var TotalPages = (data.meta) ? data.meta.totalPages : null;
    var NextPage = null;

    if (ThisPage && TotalPages && +ThisPage[1] < TotalPages) {
        NextPage = '&page%5Bnumber%5D=' + (+ThisPage[1] + 1);
        NextPage = extra.url.replace(/&page%5Bnumber%5D=[0-9]+/, NextPage);
    }
    return NextPage;
};
