// var TV4_API_BASE = 'https://graphql.tv4play.se/graphql?operationName=';
var TV4_API_BASE = 'https://tv4-graphql-web.b17g.net/graphql?operationName=';

var START_PAGE_SHA = 'ce253e3933a7de579878336774016bd9c2a6c8043233629ab035739c3b832af9';
var START_PAGE_SHA_LOGGED_IN = '0de74fcc0be0c13d524eb76cf3f9d6519417237b4b2514e702ba3f773e390c4e';
var PROGRAM_SEARCH_QUERY_SHA = '3585de8e12b3351186fa3b4f03f5703bc42eba205e9651c391e20d5a1565a1a1';
var PROGRAM_SEARCH_SHA = '78cdda0280f7e6b21dea52021406cc44ef0ce37102cb13571804b1a5bd3b9aa1';
var CATEGORY_PAGE_SHA = 'af5d3fd1a0a57608dca2f031580d80528c17d96fd146adf8a6449d3114ca2174';
var SEARCH_QUERY_SHA = '12ad45e4cebb69e34b849dee4ce045aff7cb5786b30c28a3dced805676c65b7c';
var CDP_SHA = '906eba9587ac10bd55ebb063b549b513bb690bc26dd373d95797efc57bedba67';
var VIDEO_ASSET_SHA = 'd7da6ec5c9e4f283fc78106c43db214282c6af8d5cdcf4ebe6a8ad902c37df8c';

var Tv4 = {
    result:[],
    unavailableShows:[],
    updatingUnavailableShows:false
};

Tv4.fetchUnavailableShows = function() {
    if (Config.read('tv4DrmShows'))
        Config.remove('tv4DrmShows');
    var savedShows = Config.read('tv4UnavailableShows');
    var days = 24*3600*1000;
    var tsDiff = (savedShows) ? (getCurrentDate().getTime()-savedShows.ts)/days : null;
    if (savedShows && tsDiff < 7 && tsDiff >= 0) {
        Tv4.unavailableShows = savedShows.shows.split(';');
        Log('Found saved unavailable shows, Days:' + Math.floor(tsDiff) + ' length:' + Tv4.unavailableShows.length);
    } else {
        Tv4.refreshdUnavailableShows();
    }
};

Tv4.refreshdUnavailableShows = function() {
    if (Tv4.updatingUnavailableShows)
        // Already updating
        return;
    Tv4.updatingUnavailableShows = true;
    httpRequest(Tv4.makeAllShowsLink(),
                {cb:function(status,data) {
                    Tv4.unavailableShows = [];
                    data = JSON.parse(data).data.programSearch.programs;
                    var i = 0;
                    return Tv4.checkShows(i, data);
                },
                 no_log:true
                });
};

Tv4.checkShows = function(i, data) {
    if (i < data.length) {
        httpRequest(Tv4.makeShowLink(data[i].nid),
                    {cb:function(status, program) {
                        program = JSON.parse(program).data.program.panels;
                        var anyViewable = false;
                        for (var k=0; k < program.length; k++) {
                            if (program[k].assetType == 'CLIP')
                                continue;
                            var episodes = program[k].videoList.videoAssets;
                            for (var l=0; l < episodes.length; l++) {
                                if (Tv4.isViewable(episodes[l])) {
                                    anyViewable = true;
                                    break;
                                }
                            }
                            if (anyViewable)
                                break;
                        }
                        if (!anyViewable) {
                            Tv4.unavailableShows.push(data[i].nid);
                        }
                        return Tv4.checkShows(i+1, data);
                    },
                     no_log:true
                    });
    }
    else {
        Log('Saving unavailable shows, length:' + Tv4.unavailableShows.length);
        Config.save('tv4UnavailableShows', {ts:getCurrentDate().getTime(), shows:Tv4.unavailableShows.join(';')});
        Tv4.updatingUnavailableShows = false;
        data = null;
    }
};

Tv4.reCheckUnavailableShows = function(data) {
    if (!Tv4.updatingUnavailableShows && !(data.is_clip||data.clip) && data.program) {
        var showIndex = Tv4.unavailableShows.indexOf(data.program.nid);
        if (showIndex != -1) {
            Tv4.unavailableShows.splice(showIndex,1);
            var savedShows = Config.read('tv4UnavailableShows');
            savedShows.shows = Tv4.unavailableShows.join(';');
            Config.save('tv4UnavailableShows', savedShows);
            alert(data.program.name + ' is now available');
        }
    }
};

Tv4.getMainTitle = function () {
    return 'Rekommenderat';
};

Tv4.getSectionTitle = function(location) {
    if (location.match(/Latest.html/))
        return 'Senaste';
    else if (location.match(/LatestClips.html/))
        return 'Senaste Klipp';
    else if (location.match(/PopularClips.html/))
        return 'Populära Klipp';
};

Tv4.getUrl = function(tag, extra) {
    var type = 'episode';
    var drm = (deviceYear > 2011) ? '' : '&is_drm_protected=false';
    var startDate = getCurrentDate();
    var endDate   = getCurrentDate();

    switch (tag) {
    case 'main':
        Tv4.fetchUnavailableShows();
        return Tv4.makeApiLink('StartPage',
                               '{}',
                               START_PAGE_SHA
                              );

    case 'section':
        switch(extra.location) {
        case 'LatestClips.html':
            type = 'clip';
        case 'Latest.html':
            endDate.setDate(endDate.getDate() + 1);
            startDate.setDate(startDate.getDate() - 7);
            return 'http://api.tv4play.se/play/video_assets?is_live=false&platform=web&premium=false&sort=broadcast_date_time&sort_order=desc&per_page=100&broadcast_from=' + dateToString(startDate) + '&broadcast_to=' + dateToString(endDate) + '&type=' + type + drm;

        case 'PopularClips.html':
            type = 'clip';
            break;
        default:
            break;
        }
        return 'http://api.tv4play.se/play/video_assets/most_viewed?page=1&is_live=false&platform=web&per_page=100&sort_order=desc&type=' + type + drm;

    case 'live':
        endDate.setDate(startDate.getDate() + 4);
        return 'http://api.tv4play.se/play/video_assets?broadcast_from' + dateToString(startDate) + '&broadcast_to=' + dateToString(endDate) + '&is_live=true&platform=web&sort=broadcast_date_time&sort_order=asc&per_page=100';
        break;

    case 'categories':
        switch (Tv4.getCategoryIndex().current) {
        case 0:
            return Tv4.makeStartPageLink();

        case 1:
            return Tv4.makeAllShowsLink();
        }
        break;

    case 'categoryDetail':
        return extra.location;
        break;

    case 'searchList':
        if (extra.query.length == 1)
            return Tv4.makeAllShowsLink();
        else
            return Tv4.makeApiLink('ProgramSearchQuery',
                                   '{"q":"' + extra.query + '","offset":0,"limit":100}',
                                   PROGRAM_SEARCH_QUERY_SHA
                                  );
        break;

    default:
        return tag;
        break;
    }
};

Tv4.getCategoryTitle = function() {
    switch (Tv4.getCategoryIndex().current) {
    case 0:
        return 'Kategorier';
    case 1:
        return 'Alla Program';
    }
};

Tv4.upgradeUrl = function(url) {
    if (!url) return url;
    url = url.replace('webapi.tv4play','api.tv4play');
    if (getUrlParam(url,'operationName') == 'cdp') {
        return Tv4.makeShowLink(JSON.parse(getUrlParam(url,'variables')).nid);
    }
    if (url.match(/api.tv4play.se.+&node_nids=([^&]+)$/))
        url= Tv4.makeShowLink(url.match(/api.tv4play.se.+&node_nids=([^&]+)$/)[1]);
    return url;
};

Tv4.decodeMain = function(data, extra) {

    var recommended = data.responseText;
    data = null;
    // Recommended fetched - lookup Most Viewed shows.
    requestUrl(Tv4.makeStartPageLink(),
               function(status, data) {
                   recommended = Tv4.decodeRecommended({responseText:recommended});
                   extra.cbComplete = null;
                   data = JSON.parse(data.responseText).data.startPage.mostViewedPanel.programs;
                   for (var i=0; i < data.length; i++) {
                       if (recommended.indexOf(data[i].nid) != -1)
                           continue;
                       showToHtml(data[i].name,
                                  Tv4.fixThumb(data[i].image),
                                  Tv4.makeShowLink(data[i].nid)
                                 );
                   }
                   data = null;
               },
               {cbComplete:extra.cbComplete}
              );
};

Tv4.decodeSection = function(data, extra) {
    Tv4.oldDecode(data, extra);
};

Tv4.decodeCategories = function(data, extra) {

    var Name;
    var Link;
    var Thumb;
    var LargeThumb;

    try {
        switch (Tv4.getCategoryIndex().current) {
        case 0:
            data = JSON.parse(data.responseText).data.indexPage.panels;
            for (var i=0; i < data.length; i++) {
                if (data[i].cards[0].__typename == 'PageCard') {
                    data = data[i].cards;
                    break;
                }
            }
            data.sort(function(a, b) {
                if (a.title.toLowerCase() > b.title.toLowerCase())
                    return 1;
                else
                    return -1;
            });
            for (var k=0; k < data.length; k++) {
                Name = data[k].title;
                Link = Tv4.makeApiLink('CategoryPage',
                                       '{"id":"' + data[k].page.id + '", "assetId":null}',
                                       CATEGORY_PAGE_SHA
                                      );
                Thumb = Tv4.fixThumb(data[k].images.main16x9);
                LargeThumb = Tv4.fixThumb(data[k].images.main16x9, DETAILS_THUMB_FACTOR);
                categoryToHtml(Name, Thumb, LargeThumb, Link);
	    }
            break;

        case 1:
            Tv4.decodeShows(data, extra);
            extra.cbComplete = null;
            break;
        }
        data = null;
    } catch(err) {
        Log('Tv4.decodeCategories Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Tv4.decodeCategoryDetail = function(data, extra) {
    data = JSON.parse(data.responseText).data.page.panels;
    var found = false;
    var cards = null;
    for (var k=0; k < data.length; k++) {
        if (data[k].type == 'querybasedprogramlist') {
            data = data[k].programs;
            found = true;
            break;
        } else if (data[k].cards) {
            if (!cards)
                cards = data[k].cards;
            else
                cards = cards.concat(data[k].cards);
        }
    }
    if (!found) {
        data = cards;
    }
    extra.is_json = true;
    Tv4.decodeShows(data, extra);
};

Tv4.decodeLive = function(data, extra) {
    Tv4.oldDecode(data, extra);
};

Tv4.decodeShowList = function(data, extra) {

    var UserData = extra.user_data && JSON.parse(extra.user_data);
    extra.upcoming = UserData && UserData.upcoming;
    if (!extra.is_clips && !extra.season) {
        data = JSON.parse(data.responseText).data;
        var showThumb;
        var seasons = [];
        var non_seasons = [];
        var cbComplete = extra.cbComplete;
        var clips_url = UserData && UserData.clips_url;
        var nid;
        var season;
        var all_items_url;
        var upcoming;

        // 0 Means the only season
        if (extra.season != 0) {
            showThumb = Tv4.fixThumb(data.program.image);
            upcoming = data.program.upcoming;
            nid = data.program.id;
            data = data.program.panels;
            // Find seasons and non-seasons
            for (var k=0; k < data.length; k++) {
                data[k].loadMoreParams = data[k].loadMoreParams.replace(/\\/g,'').replace(/"rows":[0-9]+/,'"limit":100').replace(/episode/,'EPISODE').replace(/node_nids/,'nodeNids').replace(/clip/,'CLIP');
                all_items_url = Tv4.makeApiLink('searchQuery',
                                                data[k].loadMoreParams,
                                                SEARCH_QUERY_SHA
                                               );
                if (data[k].assetType != 'CLIP') {
                    if (data[k].videoList.totalHits == 0)
                        continue;
                    season = data[k].videoList.videoAssets[0].season;
                    if (season > 0) {
                        if (upcoming && seasons.length == 0) {
                            // Assume it belongs to the first season
                            upcoming.thumb = showThumb;
                        } else
                            // Reset it.
                            upcoming = null;
                        seasons.push({name     : data[k].name,
                                      url      : all_items_url,
                                      season   : season,
                                      upcoming : upcoming
                                     });
                    } else {
                        // Will only find maximum of 15(?) hits...
                        non_seasons = non_seasons.concat(data[k].videoList.videoAssets);
                    }
                } else if (data[k].assetType == 'CLIP')
                    clips_url = all_items_url;
            }
            if (seasons.length > 1 || non_seasons.length >= 1) {
                for (var i=0; i < seasons.length; i++) {
                    seasonToHtml(seasons[i].name,
                                 showThumb,
                                 seasons[i].url,
                                 seasons[i].season,
                                 null,
                                 JSON.stringify({upcoming:seasons[i].upcoming})
                                );
                }
            } else if (seasons.length == 1) {
                UserData = JSON.stringify({clips_url:clips_url, upcoming:seasons[0].upcoming});
                return callTheOnlySeason(seasons[0].name, seasons[0].url, extra.loc, UserData);
            }
        }
        extra.cbComplete = false;
        if (extra.season == 0) {
            data = data.videoAssetSearch.videoAssets;
            // Init the data needed for Clips below...
            showThumb = Tv4.fixThumb(data[0].program.image);
            nid = data[0].program.nid;
            Tv4.decode(data, extra);
        } else if (non_seasons.length) {
            Tv4.decode(non_seasons, extra);
        }

        if (clips_url) {
            clipToHtml(showThumb, clips_url);
        }

        if (cbComplete) cbComplete();
    } else {
        data = JSON.parse(data.responseText).data.videoAssetSearch.videoAssets;
        Tv4.decode(data, extra);
    }
};

Tv4.decodeSearchList = function(data, extra) {

    if (extra.query.length == 1) {
        Tv4.decodeShows(data, extra);
    } else {
        var cbComplete = extra.cbComplete;
        extra.cbComplete = null;
        extra.is_json = true;
        data = JSON.parse(data.responseText).data;
        if (data.programSearch.totalHits > 0)
            extra.exclude_nids = Tv4.decodeShows(data.programSearch.programs, extra);
        extra.cbComplete=cbComplete;
        data = data.episodes.videoAssets.concat(data.clips.videoAssets);
        Tv4.decode(data, extra);
    }
    data = null;
};

Tv4.getHeaderPrefix = function() {
    return 'Tv4';
};

Tv4.keyRed = function() {
    if ($('#a-button').text().match(/Pop.*lip/)) {
	setLocation('PopularClips.html');
    } else if ($('#a-button').text().match(/lip/)) {
	setLocation('LatestClips.html');
    } else if ($('#a-button').text().match(/^Re/)) {
	setLocation('index.html');
    } else {
	setLocation('Latest.html');
    }
};

Tv4.keyGreen = function() {
    if ($('#b-button').text().match(/^[CK]ateg/))
	setLocation('categories.html');
    else
        setLocation(Tv4.getNextCategory());
};

Tv4.getNextCategory = function() {
    return getNextIndexLocation(1);
};

Tv4.getCategoryIndex = function () {
    return getIndex(1);
};

Tv4.getLiveTitle = function() {
    return 'Livesändningar';
};

Tv4.getAButtonText = function(language) {

    var loc = getIndexLocation();

    if (loc.match(/index\.html/)) {
        if(language == 'English'){
	    return 'Latest';
        } else {
	    return 'Senaste';
        }
    } else if (loc.match(/Latest\.html/)) {
        if(language == 'English'){
	    return 'Popular Clips';
        } else {
	    return 'Populära Klipp';
        }
    } else if (loc.match(/PopularClips\.html/)) {
        if(language == 'English'){
	    return 'Latest Clips';
        } else {
	    return 'Senaste Klipp';
        }
    } else {
        if(language == 'English'){
	    return 'Recommended';
        } else {
	    return 'Rekommenderat';
        }
    }
};

Tv4.getBButtonText = function(language) {
    if (getIndexLocation().match(/categories\.html/)) {
        switch (Tv4.getCategoryIndex().next) {
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

Tv4.getCButtonText = function (language) {
    if(language == 'English')
	return 'Live broadcasts';
    else
        return 'Livesändningar';
};

Tv4.determineEpisodeName = function(data) {
    var Name = data.title.trim();
    var Show = (data.program) ? data.program.name : null;
    if (Show && Name != Show) {
        Name = Name.replace(Show,'').replace(/^[,. 	:\–\-]*/,'').trim();
        Name = Name.capitalize();
    }
    return Name;
};

Tv4.decodeRecommended = function(data) {
    var nids = [];
    data = JSON.parse(data.responseText).data.indexPage.showcase;
    for (var i=0; i < data.length; i++) {
        for (var k=0; k < data[i].cards.length; k++) {
            if (data[i].cards[k].__typename == 'URLPitchCard')
                continue;
            if (data[i].cards[k].program) {
                if (nids.indexOf(data[i].cards[k].program.nid) != -1)
                    continue;
                nids.push(data[i].cards[k].program.nid);
                toHtml({name: data[i].cards[k].program.name,
                        link: Tv4.makeShowLink(data[i].cards[k].program.nid),
                        link_prefix: makeShowLinkPrefix(),
                        thumb: Tv4.fixThumb(data[i].cards[k].program.image),
                        description: data[i].cards[k].title
                       });
            } else {
                if (nids.indexOf(data[i].cards[k].videoAsset.id) != -1)
                    continue;
                nids.push(data[i].cards[k].videoAsset.id);
                data[i].cards[k] =
                    jQuery.extend(data[i].cards[k],
                                  data[i].cards[k].videoAsset
                                 );
                Tv4.decode([data[i].cards[k]]);
            }
        }
    }
    return nids;
};

Tv4.decodeVideo = function(data, CurrentDate, extra) {
    var Name;
    var Duration;
    var IsLive;
    var IsRunning;
    var starttime;
    var Link;
    var Description;
    var ImgLink;
    var Background;
    var AirDate;
    var Show=null;
    var Season=null;
    var Episode=null;

    if (!extra)
        extra = {};

    Name = data.title.trim();
    if (data.program) {
        Show = data.program.name;
        if (!Show && data.program.id)
            Show = data.program.id.capitalize();
    } else
        Show = null;
    if (extra.exclude_nids &&
        Show &&
        extra.exclude_nids.indexOf(data.program.nid) !=-1
       )
        return null;

    IsLive = data.live;
    if (!Tv4.isViewable(data, IsLive, CurrentDate))
        // Premium/DRM
        return null;

    Tv4.reCheckUnavailableShows(data);

    starttime = (IsLive) ? timeToDate(data.broadcastDateTime) : null;
    IsRunning = IsLive && starttime && (getCurrentDate() > starttime);

    if (extra.strip_show) {
        if (Tv4.result.length==0 && extra.upcoming) {
            extra.upcoming.program = data.program;
            extra.upcoming.name = Tv4.determineEpisodeName(extra.upcoming);
        }
        Name = Tv4.determineEpisodeName(data);
    }
    if (!data.image && data.images)
        data.image = data.images.main16x9;
    ImgLink = Tv4.fixThumb(data.image);
    Background = Tv4.fixThumb(data.image, BACKGROUND_THUMB_FACTOR);
    Duration = data.duration;
    Description = (data.description) ? data.description.trim() : '';
    Link = Tv4.makeVideoLink(data.id);
    AirDate = data.broadcastDateTime;
    Season = (data.season) ? data.season : null;
    Episode = (data.episode) ? data.episode : null;

    return {name:Name,
            show:Show,
            season:Season,
            episode:Episode,
            link:Link,
            thumb:ImgLink,
            background:Background,
            duration:Duration,
            description:Description,
            airDate:AirDate,
            link_prefix:'<a href="details.html?ilink=',
            is_live:IsLive,
            starttime:starttime,
            is_running:IsRunning
           };
};

Tv4.decode = function(data, extra) {
    try {
        var Item;

        if (!extra)
            extra = {};

        Tv4.result = [];

        for (var k=0; k < data.length; k++) {
            Item = Tv4.decodeVideo(data[k], getCurrentDate(), extra);
            if (!Item)
                continue;
            Tv4.result.push(Item);
        }

        if (extra.strip_show) {
            if (Tv4.result.length == 0) {
                // Has become unavailable...
                Tv4.unavailableShows.push(data[0].program.nid);
            }
            Tv4.result.sort(function(a, b){
                if (!a.episode || !b.episode)
                    return Tv4.sortOnAirDate(a, b);

                if (a.season == b.season) {
                    if (a.episode == b.episode) {
                        return Tv4.sortOnAirDate(a, b);
                    } else if (!b.episode || +a.episode > +b.episode) {
                        return -1;
                    } else {
                        return 1;
                    }
                } else if (!b.season || +a.season > +b.season) {
                    return -1;
                } else
                    return 1;
            });

            if (extra.upcoming) {
                toHtml({name:extra.upcoming.name,
                        starttime:extra.upcoming.humanBroadcastDateWithWeekday,
                        link_prefix:'<a href="upcoming.html?ilink=',
                        thumb:extra.upcoming.thumb,
                        is_upcoming: true
                       });
            }

        }

        for (var i=0; i < Tv4.result.length; i++) {
            toHtml(Tv4.result[i]);
	}
        data = null;
        Tv4.result = [];
    } catch(err) {
        Log('Tv4.decode Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};



Tv4.oldDecode = function(data, extra) {
    try {
        var Name;
        var Duration;
        var IsLive;
        var IsLiveText;
        var IsRunning;
        var starttime;
        var Link;
        var Description;
        var ImgLink;
        var Background;
        var next = null;
        var AirDate;
        var Show=null;
        var Season=null;
        var Episode=null;
        var CurrentDate = getCurrentDate();

        if (!extra)
            extra = {};

        Tv4.result = [];
        if (!extra.already_decoded)
            data = JSON.parse(data.responseText).results;

        for (var k=0; k < data.length; k++) {
            Name = data[k].title.trim();
            Show = (data[k].program) ? data[k].program.name : null;
            IsLive = data[k].is_live;
            if (!Tv4.isViewable(data[k], IsLive, CurrentDate))
                // Premium/DRM
                continue;
            Tv4.reCheckUnavailableShows(data[k]);

            starttime = (IsLive) ? timeToDate(data[k].broadcast_date_time) : null;
            IsRunning = IsLive && starttime && (getCurrentDate() > starttime);

            if (extra.strip_show) {
                Name = Tv4.determineEpisodeName(data[k]);
            }
            ImgLink = Tv4.fixThumb(data[k].image);
            Background = Tv4.fixThumb(data[k].image, BACKGROUND_THUMB_FACTOR);
            Duration = data[k].duration;
            Description = (data[k].description) ? data[k].description.trim() : '';
            Link = Tv4.makeVideoLink(data[k].id);
            AirDate = data[k].broadcast_date_time;
            Season = (data[k].season) ? data[k].season : null;
            Episode = (data[k].episode) ? data[k].episode : null;
            Tv4.result.push({name:Name, 
                             show:Show,
                             season:Season,
                             episode:Episode,
                             link:Link, 
                             thumb:ImgLink,
                             background:Background,
                             duration:Duration, 
                             description:Description,
                             airDate:AirDate,
                             link_prefix:'<a href="details.html?ilink=',
                             is_live:IsLive,
                             starttime:starttime,
                             is_running:IsRunning
                            }
                           );
        }
       
        if (extra.strip_show) {
            if (Tv4.result.length == 0) {
                // Has become unavailable...
                Tv4.unavailableShows.push(data[0].program.nid);
            }
            Tv4.result.sort(function(a, b){
                if (!a.episode || !b.episode)
                    return Tv4.sortOnAirDate(a, b);

                if (a.season == b.season) {
                    if (a.episode == b.episode) {
                        return Tv4.sortOnAirDate(a, b);
                    } else if (!b.episode || +a.episode > +b.episode) {
                        return -1;
                    } else {
                        return 1;
                    }
                } else if (!b.season || +a.season > +b.season) {
                    return -1;
                } else
                    return 1;
            });
        }

        for (var l=0; l < Tv4.result.length; l++) {
            if (!Tv4.result[l].link_prefix) {
                showToHtml(Tv4.result[l].name,
                           Tv4.result[l].thumb,
                           Tv4.result[l].link
                          );
            } else {
                toHtml(Tv4.result[l]);
            }
	}
        data = null;
        Tv4.result = [];
    } catch(err) {
        Log('Tv4.oldDecode Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Tv4.sortOnAirDate = function(a,b) {
    if (a.airDate > b.airDate)
        return -1;
    else
        return 1;
};

Tv4.decodeShows = function(data, extra) {
    try {
        var Name;
        var Link;
        var ImgLink;
        var VideoItem;
        var queryTest = (extra.query && extra.query.length == 1) ? new RegExp('^' + extra.query, 'i') : null;
        var nids = [];
        var videos = [];

        if (!extra.is_json)
            data = JSON.parse(data.responseText).data.programSearch.programs;

        Tv4.result = [];
        for (var k=0; k < data.length; k++) {
            if (data[k].__typename == 'PlayableCard') {
                VideoItem = Tv4.decodeVideo(data[k].videoAsset, getCurrentDate(), extra);
                if (VideoItem)
                    videos.push(VideoItem);
                continue;
            }
            if (data[k].program)
                data[k] = data[k].program;
            Name = data[k].name;
            if (queryTest && !queryTest.test(Name))
                continue;

            if (nids.indexOf(data[k].nid) != -1)
                // Duplicate
                continue;

            if (Tv4.unavailableShows.indexOf(data[k].nid) != -1)
                // Only drm/premium episodes
                continue;

            ImgLink = Tv4.fixThumb(data[k].image);
            Link = Tv4.makeShowLink(data[k].nid);
            Tv4.result.push({name:Name, link:Link, thumb:ImgLink});
            nids.push(data[k].nid);
        }
        data = null;

        if (!extra.query || queryTest) {
            Tv4.result.sort(function(a, b) {
                if (a.name.toLowerCase() > b.name.toLowerCase())
                    return 1;
                else
                    return -1;
            });
        }

        for (var l=0; l < Tv4.result.length; l++) {
            showToHtml(Tv4.result[l].name,
                       Tv4.result[l].thumb,
                       Tv4.result[l].link
                      );
        }

        for (var m=0; m < videos.length; m++)
            toHtml(videos[m]);

        Tv4.result = [];
    } catch(err) {
        Log('Tv4.decodeShows Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();

    return nids;
};

Tv4.getDetailsData = function(url, data) {

    if (url.match(/=(cdp|searchQuery)/))
        return Tv4.getShowData(url,data);

    var Name='';
    var Title = Name;
    var DetailsImgLink='';
    var AirDate='';
    var VideoLength = '';
    var AvailDate=null;
    var Description='';
    var NotAvailable=false;
    var isLive=false;
    var Show=null;
    var Season=null;
    var Episode=null;
    var EpisodeName = null;
    try {

        data = JSON.parse(data.responseText).data.videoAsset;

        Name = data.title;
        Title = Name;
	DetailsImgLink = Tv4.fixThumb(data.image, DETAILS_THUMB_FACTOR);
        Description  = (data.description) ? data.description.trim() : '';
        AirDate = timeToDate(data.broadcastDateTime);
        VideoLength = dataLengthToVideoLength(null, data.duration);
        isLive = data.live;
        AvailDate = data.humanDaysLeftInService.match(/([^)]+ dag[^) ]*)/);
        AvailDate = (AvailDate) ? AvailDate[1] : data.daysLeftInService + ' dagar';
        AvailDate = (AvailDate.match(/dag(ar)?$/)) ? AvailDate + ' kvar' : AvailDate;
        if (data.expire_date_time)
            AvailDate = dateToString(timeToDate(data.expire_date_time),'-') + ' (' + AvailDate + ')';

        if (isLive) {
            NotAvailable = ((AirDate - getCurrentDate()) > 60*1000);
        } else {
            NotAvailable = false;
        }
        if (data.program && Tv4.unavailableShows.indexOf(data.program.nid) == -1) {
            Show = {name : data.program.name,
                    url   : Tv4.makeShowLink(data.program.nid),
                    thumb : Tv4.fixThumb(data.program.image)
                   };
        }
        Season = (data.season) ? data.season : null;
        Episode = (data.episode) ? data.episode : null;
        EpisodeName = Tv4.determineEpisodeName(data);
    } catch(err) {
        Log('Tv4.getDetailsData Exception:' + err.message);
        Log('Name:' + Name);
        Log('AirDate:' + AirDate);
        Log('AvailDate:' + AvailDate);
        Log('VideoLength:' + VideoLength);
        Log('Description:' + Description);
        Log('NotAvailable:' + NotAvailable);
        Log('DetailsImgLink:' + DetailsImgLink);
    }
    data = null;
    return {name          : Name,
            title         : Title,
            is_live       : isLive,
            air_date      : AirDate,
            avail_date    : AvailDate,
            start_time    : AirDate,
            duration      : VideoLength,
            description   : Description,
            not_available : NotAvailable,
            thumb         : DetailsImgLink,
            season        : Season,
            episode       : Episode,
            episode_name  : EpisodeName,
            parent_show   : Show
    };
};

Tv4.getShowData = function(url, data) {
    var Name='';
    var Genre = [];
    var DetailsImgLink='';
    var Description='';

    try {
        data = JSON.parse(data.responseText).data;
        if (data.videoAssetSearch) {
            Name = itemSelected.find('a').text();
            DetailsImgLink = Tv4.fixThumb(data.videoAssetSearch.videoAssets[0].program.image, DETAILS_THUMB_FACTOR);
        } else {
            data = data.program;
            Name = data.name;
            Description = data.description.trim();
	    DetailsImgLink = Tv4.fixThumb(data.image, DETAILS_THUMB_FACTOR);
            Genre = data.displayCategory;
            // for (var i=0; i < data.tags.length; i++) {
            //     Genre.push(Tv4.tagToName(data.tags[i]));
            // }
            // Genre = Genre.join('/');
        }
    } catch(err) {
        Log('Tv4.getShowData exception:' + err.message);
        Log('Name:' + Name);
        Log('Genre:' + Genre);
        Log('Description:' + Description);
        Log('DetailsImgLink:' + DetailsImgLink);
    }
    data = null;
    return {show          : true,
            name          : Name,
            description   : Description,
            genre         : Genre,
            thumb         : DetailsImgLink
           };
};

Tv4.getDetailsUrl = function(streamUrl) {
    if (streamUrl.match(/&node_nids=/))
        return 'http://api.tv4play.se/play/programs?nids=' + streamUrl.replace(/.+&node_nids=([^&]+).*/, '$1');
    else
        return streamUrl;
};

Tv4.getPlayUrl = function(streamUrl, isLive, drm, hlsUrl) {

    var asset = decodeURIComponent(streamUrl).match(/"id":([^}]+)/)[1];
    var protocol = (drm || isLive) ? '&device=samsung-orsay&protocol=mss' : '&device=browser&protocol=dash';
    var reqUrl = 'https://playback-api.b17g.net/media/' + asset + '?service=tv4&drm=playready' + protocol;
    hlsUrl = hlsUrl || reqUrl.replace(/dash/,'hls');

    // if (isLive)
    //     reqUrl = reqUrl + '&is_live=true';

    var cbComplete = function(stream, srtUrl, license, customData, useOffset) {
        if (!stream) {
            $('.bottomoverlaybig').html('Not Available!');
        } else {
            Resolution.getCorrectStream(stream.toHttp(),
                                        srtUrl,
                                        {useBitrates:true,
                                         license:license,
                                         customdata:customData,
                                         isLive:isLive,
                                         use_offset:useOffset
                                        });
        }};

    requestUrl(RedirectIfEmulator(reqUrl),
               function(status, data) {
                   if (Player.checkPlayUrlStillValid(streamUrl)) {
                       var stream=null, license=null, srtUrl=null, customData=null;
                       data = JSON.parse(data.responseText).playbackItem;
                       stream = data.manifestUrl;
                       license = data.license && data.license.url;
                       license = data.license && data.license.castlabsServer;
                       customData = data.license && data.license.castlabsToken;
                       if (customData) {
                           data = JSON.parse(JSON.parse(atob(customData.split(".")[1])).optData);
                           data.authToken = customData;
                           customData = btoa(JSON.stringify(data));
                       }
                       if (!drm && license && reqUrl != hlsUrl) {
                           hlsUrl = stream.replace(/\.mpd/,'.m3u8');
                           return Tv4.getPlayUrl(streamUrl, isLive, true, hlsUrl);
                       } else if (!isLive) {
                           hlsUrl = (drm) ? hlsUrl : stream.replace(/\.mpd/,'.m3u8');
                           Tv4.getSrtUrl(asset,
                                         function(srtUrl){
                                             cbComplete(stream, srtUrl, license, customData);
                                         });
                       } else {
                           // Use offset for live shows with 'startOver'
                           Tv4.checkUseOffset(streamUrl,
                                              function(useOffset) {
                                                  cbComplete(stream, null, license, customData, useOffset);
                                              });
                       }
                   }
               }
              );
};

Tv4.getSrtUrl = function (asset, cb) {
    var url = 'https://playback-api.b17g.net/subtitles/' + asset + '?service=tv4&format=webvtt';
    var srtUrl = null;
    requestUrl(RedirectIfEmulator(url),
               function(status, data) {
                   try {
                       srtUrl = JSON.parse(data.responseText)[0].url.toHttp();
                   } catch (err) {
                       Log('No subtitles: ' + err + ' url:' + url);
                   }
               },
               {cbComplete: function() {cb(srtUrl);}}
              );
};

Tv4.checkUseOffset = function(streamUrl, cb) {
    requestUrl(Tv4.getDetailsUrl(streamUrl),
               function(status, data) {
                   data = JSON.parse(data.responseText).data;
                   cb(data && data.videoAsset.startOver);
               });
};

Tv4.makeApiLink = function(Operation, variables, sha) {
    var Link = addUrlParam(TV4_API_BASE + Operation,
                           'variables',
                           variables
                          );
    return RedirectIfEmulator(addUrlParam(Link,
                                          'extensions',
                                          '{"persistedQuery":{"version":1,"sha256Hash":"' + sha + '"}}'
                                         )
                             );
};

Tv4.makeStartPageLink = function(id) {
    return Tv4.makeApiLink('StartPage',
                           '{"loggedIn":false}',
                           START_PAGE_SHA_LOGGED_IN
                          );
};

Tv4.makeShowLink = function(nid) {
    return Tv4.makeApiLink('cdp',
                           '{"nid":"' + nid + '"}',
                           CDP_SHA
                          );
};

Tv4.makeVideoLink = function(id) {
    return Tv4.makeApiLink('VideoAsset',
                           '{"id":' + id + '}',
                           VIDEO_ASSET_SHA
                          );
};

Tv4.makeAllShowsLink = function() {
    return Tv4.makeApiLink('ProgramSearch',
                           '{"order_by":"NAME","per_page":1000}',
                           PROGRAM_SEARCH_SHA
                          );
};

Tv4.fixThumb = function(thumb, factor) {
    if (!thumb) return thumb;
    if (!factor) factor = 1;
    var size = Math.round(factor*THUMB_WIDTH) + 'x' + Math.round(factor*THUMB_HEIGHT);
    return RedirectIfEmulator(addUrlParam('https://imageproxy.b17g.services/?format=jpeg&quality=80&resize=' + size + '&retina=false&shape=cut', 'source', thumb));
};

Tv4.tagToName = function(string) {
    var words = string.split('-');
    for (var i=0; i < words.length; i++)
        words[i] = words[i].capitalize();
    return words.join(' ');
};

Tv4.isViewable = function (data, isLive, currentDate) {
    if (data.is_drm_protected && deviceYear < 2012 && !isEmulator)
        return false;
    else {
        if (isLive) {
            // We want to see what's ahead...
            return true;
        } else {
            if (!currentDate)
                currentDate = getCurrentDate();
            if (data.broadcast_date_time)
                return currentDate > timeToDate(data.broadcast_date_time);
            else
                return currentDate > timeToDate(data.broadcastDateTime);
        }
    }
};

Tv4.requestNextPage = function(url, callback) {
    requestUrl(url,callback,callback);
};

Tv4.getHeaders = function() {
    return [{key:'platform', value:'web'}];
};
