var TV4_API_BASE = 'https://graphql.tv4play.se/graphql';
var SHOW_PARAMS = '{description,displayCategory,image,name,nid}';
var PROGRAMS_PARAMS = 'programs' + SHOW_PARAMS;
var VIDEO_PARAMS = '{broadcastDateTime,clip,daysLeftInService,description,duration,episode,expireDateTime,humanBroadcastDateTime,id,image,live,program' + SHOW_PARAMS + ',season,startOver,title}';
var VIDEO_LIST_PARAMS = 'videoList(offset:0,limit:100){totalHits,videoAssets' + VIDEO_PARAMS + '}';
var CARD_UNION = '{cards(limit:5){__typename ... on ProgramPitchCard{program' + SHOW_PARAMS + ',title} ... on PlayablePitchCard{images{main16x9},kicker,title,videoAsset' + VIDEO_PARAMS +'}}}';

var Tv4 = {
    result:[],
    unavailableShows:[],
    movies:[],
    movieDetails:[],
    updatingShows:false,
    loaded:false
};

Tv4.fetchShows = function() {
    Tv4.loaded = true;
    if (Config.read('tv4DrmShows'))
        Config.remove('tv4DrmShows');
    var savedShows = Config.read('tv4UnavailableShows');
    var movies     = Config.read('tv4Movies');
    var days = 24*3600*1000;
    var tsDiff = (savedShows) ? (getCurrentDate().getTime()-savedShows.ts)/days : null;
    if (savedShows && tsDiff < 7 && tsDiff >= 0) {
        Tv4.unavailableShows = savedShows.shows.split(';');
        Tv4.movies           = (movies && movies.shows.split(';')) || [];
        Tv4.movieDetails     = (movies && movies.details) || [];
        Log('Found saved shows, Days:' + Math.floor(tsDiff) + ' unavailable:' + Tv4.unavailableShows.length + ' movies:' + Tv4.movies.length);
    } else {
        Tv4.refreshShows();
    }
};

Tv4.refreshShows = function() {
    if (Tv4.updatingShows)
        // Already updating
        return;
    Tv4.updatingShows = true;
    Log('Refresh shows');
    httpRequest(Tv4.makeAllShowsLink(),
                {cb:function(status,data) {
                    Tv4.unavailableShows = [];
                    Tv4.movies = [];
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
                        try {
                            if (status == 'timeout')
                                return Tv4.checkShows(i, data);
                            program = JSON.parse(program).data.program;
                        } catch (err) {
                            Log('Failed to check shows:' + err + ' status:' + status);
                            Tv4.updatingShows = false;
                            return;
                        }
                        var anyViewable = false;
                        var isMovie = Tv4.isMovie(program);
                        program = program.videoPanels;
                        for (var k=0; k < program.length; k++) {
                            if (program[k].assetType == 'CLIP')
                                continue;
                            var episodes = program[k].videoList.videoAssets;
                            for (var l=0; l < episodes.length; l++) {
                                if (Tv4.isViewable(episodes[l])) {
                                    anyViewable = true;
                                    if (isMovie) {
                                        Tv4.movies.push(data[i].nid);
                                        Tv4.movieDetails.push({nid : data[i].nid,
                                                               id  : episodes[l].id
                                                              });
                                    }
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
                     timeout:15*1000,
                     no_log:true
                    });
    }
    else {
        Config.save('tv4UnavailableShows', {ts:getCurrentDate().getTime(), shows:Tv4.unavailableShows.join(';')});
        Tv4.saveMovies();
        Log('Saved shows, unavailable:' + Tv4.unavailableShows.length + ' movies:' + Tv4.movies.length);
        Tv4.updatingShows = false;
        data = null;
    }
};

Tv4.reCheckUnavailableShows = function(data) {
    if (!Tv4.updatingShows && !(data.is_clip||data.clip) && data.program) {
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
};

Tv4.getUrl = function(tag, extra) {

    if (!Tv4.loaded)
        Tv4.fetchShows();

    switch (tag) {
    case 'main':
        return Tv4.makeApiLink('indexPage{showcase{__typename ... on TopCarousel' + CARD_UNION + ' ... on ShowcaseMosaic' + CARD_UNION + '}}');

    case 'section':
        var type = 'EPISODE';
        if (extra.location == 'LatestClips.html')
            type = 'CLIP';
        return Tv4.makeLatestLink(type);

    case 'live':
        return Tv4.makeApiLink('liveVideos{videoAssets' + VIDEO_PARAMS + '}');
        break;

    case 'categories':
        switch (Tv4.getCategoryIndex().current) {
        case 0:
            return Tv4.makeApiLink('pageSearch(query:""){totalHits,pages{title,id,images{main16x9},panels{__typename}}}');

        case 1:
            return Tv4.makeStartPageLink();

        case 2:
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
            return Tv4.makeApiLink('programSearch(per_page:1000,q:"' + extra.query + '"){totalHits,' + PROGRAMS_PARAMS + '}');
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
        return 'Utvalt';
    case 2:
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
        url = Tv4.makeShowLink(url.match(/api.tv4play.se.+&node_nids=([^&]+)$/)[1]);
    return url.match('graphql.tv4play.se') ? RedirectTls(url) : url;
};

Tv4.decodeMain = function(data, extra) {

    var recommended = data.responseText;
    data = null;
    // Recommended fetched - lookup Most Viewed shows.
    requestUrl(Tv4.makeStartPageLink(),
               function(status, data) {
                   recommended = Tv4.decodeRecommended({responseText:recommended});
                   extra.cbComplete = null;
                   data = Tv4.findMostViewed(data.responseText) || [];
                   Tv4.decodeShows(data, {is_json:true, nids:recommended, no_sort:true});
                   data = null;
               },
               {cbComplete:extra.cbComplete}
              );
};

Tv4.decodeSection = function(data, extra) {
    data = JSON.parse(data.responseText).data.videoAssetSearch.videoAssets;
    Tv4.decode(data, extra);
};

Tv4.decodeCategories = function(data, extra) {

    var Name;
    var Link;
    var Thumb;

    try {
        switch (Tv4.getCategoryIndex().current) {
        case 0:
            var categories = [];
            data = JSON.parse(data.responseText).data.pageSearch.pages;
            for (var i=0; i < data.length; i++) {
                for (var k=0; k < data[i].panels.length; k++) {
                    if (data[i].panels[k].__typename == 'ExpandableProgramList') {
                        categories.push({title: data[i].title,
                                         thumb: data[i].images.main16x9,
                                         id   : data[i].id
                                        });
                        break;
                    }
                }
            }
            categories.sort(function(a, b) {
                if (a.title.toLowerCase() > b.title.toLowerCase())
                    return 1;
                else
                    return -1;
            });
            for (var k=0; k < categories.length; k++) {
                Link = Tv4.makeCategoryLink(categories[k].id),
                categoryToHtml(categories[k].title,
                               Tv4.fixThumb(categories[k].thumb),
                               Tv4.fixThumb(categories[k].thumb, DETAILS_THUMB_FACTOR),
                               Link
                              );
	    }
            break;

        case 1:
            data = JSON.parse(data.responseText).data.page.panels2.items
            for (var i=0; i < data.length; i++) {
                if (!data[i].content2) continue;
                Thumb = data[i].content2.items[0].item.image;
                categoryToHtml(data[i].title,
                               Tv4.fixThumb(Thumb),
                               Tv4.fixThumb(Thumb, DETAILS_THUMB_FACTOR),
                               addUrlParam(extra.url, 'index', i)
                              );
            }
            break;

        case 2:
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
    data = JSON.parse(data.responseText).data.page;
    if (data.panels) {
        data = data.panels;
        for (var k=0; k < data.length; k++) {
            if (data[k].__typename == 'ExpandableProgramList') {
                data = data[k].programs;
                break;
            }
        }
    } else {
        data = data.panels2.items[+getUrlParam(extra.url,'index')].content2.items;
        extra.no_sort = true;
    }
    extra.is_json = true;
    Tv4.decodeShows(data, extra);
};

Tv4.decodeLive = function(data, extra) {
    data = JSON.parse(data.responseText).data.liveVideos.videoAssets;
    extra.is_live = true;
    Tv4.decode(data, extra);
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
        var season;
        var all_items_url;
        var upcoming;

        // 0 Means the only season
        if (data.program && extra.season != 0) {
            showThumb = Tv4.fixThumb(data.program.image);
            upcoming = data.program.upcoming;
            if (upcoming) upcoming.is_upcoming = true;
            if (Tv4.isMovie(data.program)) {
                Tv4.addMovie(data.program);
            }
            data = data.program.videoPanels;
            // Find seasons and non-seasons
            for (var k=0; k < data.length; k++) {
                all_items_url = Tv4.makeApiLink('videoPanel(id:"' + data[k].id + '"){' + VIDEO_LIST_PARAMS + '}');
                if (data[k].assetType != 'CLIP') {
                    if (data[k].videoList.totalHits == 0)
                        continue;
                    season = data[k].videoList.videoAssets[0].season;
                    if (season > 0) {
                        seasons.push({name     : data[k].name,
                                      url      : all_items_url,
                                      season   : season,
                                      upcoming : upcoming && upcoming.season == season && upcoming
                                     });
                    } else {
                        non_seasons = non_seasons.concat(data[k].videoList.videoAssets);
                    }
                } else if (data[k].assetType == 'CLIP')
                    clips_url = all_items_url;
            }
            seasons.sort(function(a, b){
                return b.season-a.season;
            });
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
            data = data.videoPanel.videoList.videoAssets;
            // Init the data needed for Clips below...
            showThumb = Tv4.fixThumb(data[0].program.image);
            Tv4.decode(data, extra);
        } else if (non_seasons.length) {
            Tv4.decode(non_seasons, extra);
        }

        if (clips_url) {
            clipToHtml(showThumb, clips_url);
        }

        if (cbComplete) cbComplete();
    } else {
        data = JSON.parse(data.responseText).data.videoPanel.videoList.videoAssets;
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
        var showData = JSON.parse(data.responseText).data.programSearch.programs;
        data = null;
        requestUrl(Tv4.makeVideoSearchLink('EPISODE', extra.query),
                   function(status, data) {
                       var episodeData = JSON.parse(data.responseText).data.videoAssetSearch;
                       data = null;
                       requestUrl(Tv4.makeVideoSearchLink('CLIP', extra.query),
                                  function(status, data) {
                                      extra.exclude_nids = Tv4.decodeShows(showData, extra);
                                      data = JSON.parse(data.responseText).data.videoAssetSearch;
                                      data = episodeData.videoAssets.concat(data.videoAssets);
                                      episodeData = null;
                                      extra.cbComplete=cbComplete;
                                      Tv4.decode(data, extra);
                                  }
                                 );
                   });
    };
};

Tv4.getHeaderPrefix = function() {
    return 'Tv4';
};

Tv4.keyRed = function() {
    if ($('#a-button').text().match(/lip/)) {
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
    return getNextIndexLocation(2);
};

Tv4.getCategoryIndex = function () {
    return getIndex(2);
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
                return 'Utvalt';
            else
                return 'Collections';
            break;
        case 2:
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
    var Link;
    var LinkPrefix;
    var Background;
    data = JSON.parse(data.responseText).data.indexPage.showcase;
    for (var i=0; i < data.length; i++) {
        for (var k=0; k < data[i].cards.length; k++) {
            if (data[i].cards[k].__typename == 'URLPitchCard')
                continue;
            if (data[i].cards[k].program) {
                if (nids.indexOf(data[i].cards[k].program.nid) != -1)
                    continue;
                nids.push(data[i].cards[k].program.nid);
                Link = Tv4.getMovieLink(data[i].cards[k].program.nid);
                if (Link) {
                    LinkPrefix = '<a href="details.html?ilink=';
                    Background = Tv4.fixThumb(data[i].cards[k].program.image, BACKGROUND_THUMB_FACTOR);
                } else {
                    Link = Tv4.makeShowLink(data[i].cards[k].program.nid);
                    LinkPrefix = makeShowLinkPrefix();
                    Background = null;
                }

                toHtml({name        : data[i].cards[k].program.name,
                        link        : Link,
                        link_prefix : LinkPrefix,
                        thumb       : Tv4.fixThumb(data[i].cards[k].program.image),
                        description : data[i].cards[k].title,
                        background  : Background
                       });
            } else if (data[i].cards[k].videoAsset) {
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
    if (!Tv4.isViewable(data, extra.is_live && IsLive, CurrentDate))
        // Premium/DRM
        return null;

    Tv4.reCheckUnavailableShows(data);

    starttime = (IsLive || data.is_upcoming) ? timeToDate(data.broadcastDateTime) : null;
    IsRunning = IsLive && starttime && (getCurrentDate() > starttime);

    Description = (data.description) ? data.description.trim() : '';
    if (extra.strip_show) {
        Name = Tv4.determineEpisodeName(data);
    } else if (data.kicker) {
        Description = Name;
        Name = data.kicker;
    }
    if (!data.image && data.images)
        data.image = data.images.main16x9;
    ImgLink = Tv4.fixThumb(data.image);
    Background = Tv4.fixThumb(data.image, BACKGROUND_THUMB_FACTOR);
    Duration = data.duration;
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
            is_running:IsRunning,
            is_upcoming:data.is_upcoming
           };
};

Tv4.decode = function(data, extra) {
    try {
        var Item;

        if (!extra)
            extra = {};

        Tv4.result = [];

        if (extra.upcoming)
            data.unshift(extra.upcoming);

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

Tv4.sortOnAirDate = function(a,b) {
    if (a.airDate > b.airDate)
        return -1;
    else
        return 1;
};

Tv4.decodeShows = function(data, extra) {
    try {
        var Name;
        var Description;
        var LinkPrefix;
        var Link;
        var ImgLink;
        var Background;
        var IsMovie;
        var VideoItem;
        var queryTest = (extra.query && extra.query.length == 1) ? new RegExp('^' + extra.query, 'i') : null;
        var nids = extra.nids || [];
        var videos = [];

        if (!extra.is_json)
            data = JSON.parse(data.responseText).data.programSearch.programs;

        Tv4.result = [];
        for (var k=0; k < data.length; k++) {
            if (data[k].item)
                data[k] = data[k].item;
            if (data[k].__typename == 'PlayableCard' ||
                data[k].__typename == 'VideoAsset'
               ) {
                if (data[k].videoasset)
                    data[k] = data[k].videoAsset;
                VideoItem = Tv4.decodeVideo(data[k], getCurrentDate(), extra);
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
            Description = data[k].description;
            LinkPrefix = null;
            Background = null;
            Link = Tv4.getMovieLink(data[k].nid);
            IsMovie = (Link != null);
            if (IsMovie) {
                Background  = Tv4.fixThumb(data[k].image, BACKGROUND_THUMB_FACTOR);
                LinkPrefix = '<a href="details.html?ilink=';
            } else
                Link = Tv4.makeShowLink(data[k].nid);
            Tv4.result.push({name        : Name,
                             description : Description,
                             link_prefix : LinkPrefix,
                             link        : Link,
                             thumb       : ImgLink,
                             background  : Background,
                             is_movie    : IsMovie
                            });
            nids.push(data[k].nid);
        }
        data = null;

        if ((!extra.query || queryTest) && !extra.no_sort) {
            Tv4.result.sort(function(a, b) {
                if (a.name.toLowerCase() > b.name.toLowerCase())
                    return 1;
                else
                    return -1;
            });
        }

        for (var l=0; l < Tv4.result.length; l++) {
            if (Tv4.result[l].is_movie)
                toHtml(Tv4.result[l]);
            else
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

Tv4.isMovie = function(data) {
    return data.type == 'MOVIE' && !data.upcoming && data.videoPanels.length == 1 &&
        data.videoPanels[0].videoList.videoAssets.length == 1 &&
        data.videoPanels[0].videoList.videoAssets[0].program;
};

Tv4.getMovieLink = function(nid) {
    var index = Tv4.movies.indexOf(nid);
    if (index != -1 && Tv4.movieDetails[index].nid==nid) {
        return Tv4.makeVideoLink(Tv4.movieDetails[index].id);
    }
    return null;
};

Tv4.addMovie = function(data) {
    nid = data.videoPanels[0].videoList.videoAssets[0].program.nid;
    if (!Tv4.updatingShows && Tv4.movies.indexOf(nid) == -1) {
        Tv4.movies.push(nid);
        Tv4.movieDetails.push({nid:nid, id:data.videoPanels[0].videoList.videoAssets[0].id});
        Tv4.saveMovies();
    }
};

Tv4.saveMovies = function() {
    Config.save('tv4Movies', {shows:Tv4.movies.join(';'), details:Tv4.movieDetails});
};

Tv4.getDetailsData = function(url, data) {

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

        data = JSON.parse(data.responseText).data;
        if (data.program || data.videoPanel)
            return Tv4.getShowData(url, data);
        else
            data = data.videoAsset;

        Name = data.title;
        Title = Name;
	DetailsImgLink = Tv4.fixThumb(data.image, DETAILS_THUMB_FACTOR);
        Description  = (data.description) ? data.description.trim() : '';
        AirDate = timeToDate(data.broadcastDateTime);
        VideoLength = dataLengthToVideoLength(null, data.duration);
        isLive = data.live;
        // AvailDate = data.humanDaysLeftInService.match(/([^)]+ dag[^)+ ]*)/);
        AvailDate = data.daysLeftInService + ' dagar kvar';
        if (data.expireDateTime)
            AvailDate = dateToString(timeToDate(data.expireDateTime),'-') + ' (' + AvailDate + ')';

        NotAvailable = ((AirDate - getCurrentDate()) > 60*1000);

        if (data.program && Tv4.unavailableShows.indexOf(data.program.nid) == -1) {
            Show = data.program;
            if (Tv4.movies.indexOf(Show.nid) != -1) {
                Show.name = Show.displayCategory;
                Show.displayCategory = Show.displayCategory.replace(' & ', '-och-');
                Show = {name        : Show.name,
                        url         : Tv4.makeCategoryLink(Show.displayCategory.toLowerCase()),
                        thumb       : Tv4.fixThumb(Show.image),
                        large_thumb : Tv4.fixThumb(Show.image, DETAILS_THUMB_FACTOR),
                        is_category : true
                       };
            } else {
                Show = {name  : Show.name,
                        url   : Tv4.makeShowLink(Show.nid),
                        thumb : Tv4.fixThumb(Show.image)
                       };
            }
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
        if (data.videoPanel) {
            Name = itemSelected.find('a').text();
            DetailsImgLink = Tv4.fixThumb(data.videoPanel.videoList.videoAssets[0].program.image, DETAILS_THUMB_FACTOR);
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

Tv4.getPlayUrl = function(streamUrl, isLive, wmdrm, hlsUrl) {

    var asset = decodeURIComponent(streamUrl).match(/id:"([^"]+)/)[1];
    var protocol = (wmdrm || isLive) ? '&device=samsung-orsay&protocol=mss' : '&device=browser&protocol=dash';
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
                           data = JSON.parse(JSON.parse(atob(customData.split('.')[1])).optData);
                           data.authToken = customData;
                           customData = btoa(JSON.stringify(data));
                       }
                       if (!wmdrm && ((license && reqUrl != hlsUrl) || stream.match(/\/\.mpd/))) {
                           hlsUrl = stream.replace(/\.mpd/,'.m3u8');
                           return Tv4.getPlayUrl(streamUrl, isLive, true, hlsUrl);
                       } else if (!isLive) {
                           hlsUrl = (wmdrm) ? hlsUrl : stream.replace(/\.mpd/,'.m3u8');
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

Tv4.makeApiLink = function(Params) {

    return RedirectTls(addUrlParam(TV4_API_BASE,
                                   'query',
                                   'query{' + Params + '}'
                                  )
                      );
};

Tv4.makeStartPageLink = function() {
    var Input = 'input:{offset:0,limit:100}';
    var Link  = 'page(id: "startpage") {panels2(' + Input + ')' +
        '{__typename ... on PagePanelsResult {items {' +
        '__typename ... on SwipeModule {title,content2(' + Input + '){items{item{' +
        '__typename ... on Program' + SHOW_PARAMS + ',' +
        '__typename ... on VideoAsset' + VIDEO_PARAMS  +
        '}}}}}}}}';
    return Tv4.makeApiLink(Link);
};

Tv4.makeCategoryLink = function(id) {
    return Tv4.makeApiLink('page(id:"' + id + '"){panels{__typename ... on ExpandableProgramList{programs{program' + SHOW_PARAMS + '}}}}');
};

Tv4.makeShowLink = function(nid) {
    return Tv4.makeApiLink('program(nid:"' + nid + '"){name,description,image,displayCategory,upcoming' + VIDEO_PARAMS+ ',type,videoPanels{assetType,name,id,' + VIDEO_LIST_PARAMS + '}}');
};

Tv4.makeVideoLink = function(id) {
    return Tv4.makeApiLink('videoAsset(id:"' + id + '",includeUpcoming:true)' + VIDEO_PARAMS);
};

Tv4.makeAllShowsLink = function() {
    return Tv4.makeApiLink('programSearch(per_page:1000){' + PROGRAMS_PARAMS + '}');
};

Tv4.makeLatestLink = function(type) {
    var startDate = getCurrentDate();
    var endDate   = getCurrentDate();
    endDate.setDate(endDate.getDate() + 1);
    endDate = dateToString(endDate);
    startDate.setDate(startDate.getDate() - 7);
    startDate  = dateToString(startDate);
    return Tv4.makeApiLink('videoAssetSearch(type:' + type + ',broadcastFrom:"'+startDate+'",broadcastTo:"' + endDate + '",limit:100){totalHits,videoAssets' + VIDEO_PARAMS + '}');
};

Tv4.makeVideoSearchLink = function(type, query) {
    return Tv4.makeApiLink('videoAssetSearch(type:' + type + ',limit:100,q:"' + query + '"){totalHits,videoAssets' + VIDEO_PARAMS + '}');
};

Tv4.findMostViewed = function(data) {
    data = JSON.parse(data).data.page.panels2.items;
    for (var i=0; i < data.length; i++) {
        if (data[i].__typename == 'Promo') continue;
        if (!data[i].title) continue;
        if (data[i].title.match('Mest sedda') || data[i].title.match('^Popul'))
            return data[i].content2.items;
    }
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
        if (isLive || data.is_upcoming) {
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
