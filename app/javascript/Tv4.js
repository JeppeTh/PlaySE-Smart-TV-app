var TV4_API_BASE = RedirectTls('https://client-gateway.tv4.a2d.tv/graphql');
var PAGE_INFO_FIELDS = 'fragment PageInfoFields on PageInfo{hasNextPage nextPageOffset totalCount}';
var PAGE_LIST_FIELDS = 'fragment PageListFields on PageReference{id title images{image16x9{...ImageFieldsFull} image4x3{...ImageFieldsFull}}}';
var LABEL_FIELDS = 'fragment LabelFields on Label {announcement recurringBroadcast}';
var IMAGE_LIGHT_FIELDS = 'fragment ImageFieldsLight on Image {sourceEncoded}';
var IMAGE_FULL_FIELDS = 'fragment ImageFieldsFull on Image{sourceEncoded}';
var IMAGE_FIELDS = IMAGE_FULL_FIELDS + IMAGE_LIGHT_FIELDS;
var SERIES_FIELDS = 'fragment SeriesFieldsLight on Series {id title slug genres numberOfAvailableSeasons upcomingEpisode{...UpcomingEpisodeFields} label {...LabelFields} images {main16x9Annotated {...ImageFieldsLight}} upsell {tierId}}fragment UpcomingEpisodeFields on UpcomingEpisode {playableFrom{isoString}}';
var MOVIE_FIELDS = 'fragment MovieFieldsLight on Movie {id title isLiveContent liveEventEnd {isoString} playableFrom{isoString} label {...LabelFields} images {main16x9Annotated{...ImageFieldsLight} cover2x3{...ImageFieldsLight}} synopsis{medium} upsell{tierId}}';
var SPORT_FIELDS = 'fragment SportEventFieldsLight on SportEvent{title id league round images{main16x9{...ImageFieldsLight}} playableFrom{isoString} liveEventEnd{isoString} isLiveContent upsell{tierId}}';
var CLIP_FIELDS = 'fragment ClipFieldsLight on Clip {id title clipVideo: video {...VideoFields} images {main16x9 {...ImageFieldsLight}} playableFrom {readableDistance} parent {... on ClipParentSeriesLink {id title} ... on ClipParentMovieLink {id title}}}';
var VIDEO_FIELDS = 'fragment VideoFields on Video {id duration {seconds} isLiveContent access {hasAccess} isDrmProtected}';
var EPISODE_FIELDS = 'fragment EpisodeFields on Episode{id title extendedTitle isLiveContent isStartOverEnabled series{id title} images{main16x9{...ImageFieldsLight}} liveEventEnd{isoString} playableUntil{isoString} playableFrom{isoString} video{...VideoFields} upsell{ tierId}}';
var EPISODE_VIDEO_FIELDS = 'fragment EpisodeVideoFields on Episode{id title extendedTitle isLiveContent liveEventEnd{isoString} series{title id} synopsis{medium} images{main16x9{ ...ImageFieldsLight}} video{ ...VideoFields} playableFrom{isoString} playableUntil{isoString}}';
var CHANNEL_FIELDS = 'fragment ChannelFields on Channel{id title description tagline type images{main16x9{...ImageFieldsLight}} access{hasAccess} epg{end start title images{main16x9{...ImageFieldsLight}}}}';
var MOVIE_VIDEO_FIELDS = 'fragment MovieVideoFields on Movie{id title liveEventEnd{isoString} isLiveContent synopsis{medium} images{main16x9{ ...ImageFieldsLight sourceEncoded}} video{ ...VideoFields} playableFrom{isoString} playableUntil{isoString}}';
var SPORT_VIDEO_FIELDS = 'fragment SportEventVideoFields on SportEvent{title id isLiveContent isDrmProtected access{hasAccess} synopsis{medium} images{main16x9{...ImageFieldsLight sourceEncoded}} playableUntil{isoString} playableFrom{isoString} liveEventEnd{isoString}}';
var CHANNEL_VIDEO_FIELDS = 'fragment ChannelVideoFields on Channel{title id description isDrmProtected access{hasAccess} epg{end start title type synopsis{medium} images{main16x9{sourceEncoded}}} images{main16x9{ ...ImageFieldsLight sourceEncoded}}}';
var MEDIA_FIELDS = SERIES_FIELDS + MOVIE_FIELDS + SPORT_FIELDS + CLIP_FIELDS + VIDEO_FIELDS + IMAGE_FIELDS + LABEL_FIELDS;

var Tv4 = {
    result:[],
    collections:null,
    thumbs:{},
    sport:null,
    pages:{},
    shows: {},
    live_panels: [],
    live_id: null,
    token: null,
    failedUpgrades: []
};

Tv4.login = function(cb, attempts) {
    if (Tv4.token) return cb && cb();

    if (Config.read('tv4UnavailableShows') || Config.read('tv4Movies')) {
        Config.remove('tv4DrmShows');
        Config.remove('tv4UnavailableShows');
        Config.remove('tv4Movies');
    }
    attempts = attempts || 1;
    var use_sync = (cb == null);
    var refresh_token = Tv4.getRefreshToken();

    if (refresh_token) {
        Tv4.syncAuth(use_sync,
                     httpRequest('https://avod-auth-alb.a2d.tv/oauth/refresh',
                                 {cb: function(status,data) {
                                     Tv4.handleAuthResult(data, cb);
                                 },
                                  sync : use_sync,
                                  headers : [{key:'content-type', value:'application/json'}],
                                  params: '{"refresh_token":"' + refresh_token + '", "client_id":"tv4-web", "profile_id":"' + Tv4.getProfileId() + '"}'
                                 }
                                )
                    );
    } else {
        if (attempts < 4)
            window.setTimeout(function(){Tv4.login(cb, attempts+1);}, 1000);
        else
            PopUp('No refresh_token');
    }
};

Tv4.getRefreshToken = function() {
    var token = Tv4.readConfig('tv4Token');
    if (!token)
        Log('Failed to retrieve token.');
    return token;
};

Tv4.getProfileId = function() {
    return Tv4.readConfig('tv4ProfileId') || 'default';
};

Tv4.readConfig = function(tag) {
    var fileSysObj = new FileSystem();
    var fileObj = fileSysObj.openFile('config.xml','r');
    var config = fileObj.readAll();
    fileSysObj.closeFile(fileObj);
    var regexp = new RegExp(tag + '> *([^< ]+)');
    config = config.match(regexp);
    return config && config[1];
};

Tv4.syncAuth = function (use_sync, result) {
    if (use_sync) Tv4.handleAuthResult(result.data);
};

Tv4.handleAuthResult = function(data, cb) {
    try {
        Tv4.token = JSON.parse(data).access_token;
        var expires = JSON.parse(atob(Tv4.token.split('.')[1])).exp;
        window.setTimeout(function() {
            alert('refreshing');
            Tv4.token = null;
            Tv4.login();
        }, new Date(expires*1000) - new Date());
    } catch(err) {
        cb && PopUp('Login failed:' + data);
    }
    cb && cb();
};

Tv4.getMainTitle = function () {
    return 'Rekommenderat';
};

Tv4.getSectionTitle = function(location) {
    if (location.match(/News.html/))
        return 'Nyheter';
    else if (location.match(/Sport.html/))
        return 'Sport';
    else if (location.match(/Clips.html/))
        return 'Klipp';
};

Tv4.getUrl = function(tag, extra) {
    return TV4_API_BASE;
};

Tv4.getPostData = function(tag, extra) {
    var id = getUrlParam(extra.url, 'clip_id');
    if (id) return Tv4.getPanelQuery(id, 100);

    id = getUrlParam(extra.url, 'show_id');
    if (id) return Tv4.getShowQuery(id);

    id = getUrlParam(extra.url, 'season_id');
    if (id) return Tv4.getSeasonQuery(id);

    id = getUrlParam(extra.url, 'related_id');
    if (extra.location && extra.location.match(/related\.html/)) {
        id = getUrlParam(getUrlParam(extra.location,'url'), 'related_id');
    }
    if (id) return Tv4.getRelatedQuery(id);

    id = getUrlParam(extra.url, 'category_id');
    if (id) return Tv4.getPageQuery(id);

    id = getUrlParam(extra.url, 'page_id');
    if (id) return Tv4.getPageQuery(id);

    id = getUrlParam(extra.url, 'panel_id');
    if (id) return Tv4.getPanelQuery(id, getUrlParam(extra.url, 'limit'));
    id = getUrlParam(extra.url, 'live_panel_id');
    if (id) return Tv4.getLivePanelQuery(id);

    var type = getUrlParam(extra.url, 'search_type');
    if (type)
        return Tv4.getListSearchQuery(getUrlParam(extra.url,'query'), type, 100);

    switch (tag) {
    case 'main':
        return Tv4.getPageQuery('start');

    case 'section':
        if (extra.location == 'Sport.html')
            return Tv4.getPageQuery('sport');
        if (extra.location == 'Clips.html')
            return Tv4.getClipMenuQuery();
        else
            return Tv4.getPageQuery('news');

    case 'live':
        return Tv4.getChannelQuery();
        break;

    case 'categories':
        switch (Tv4.getCategoryIndex().current) {
        case 0:
            return Tv4.getCategoryQuery();

        case 1:
            return Tv4.getPageQuery('start');

        case 2:
            return Tv4.getAllShowsQuery();
        }
        break;

    case 'searchList':
        if (extra.query.length == 1)
            return Tv4.getAllShowsQuery('["' + extra.query + '"]');
        else
            return Tv4.getListSearchQuery(extra.query, 'SERIES');
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

Tv4.getLiveTitle = function() {
    return 'Kanaler';
};

Tv4.upgradeUrl = function(url) {
    if (!url) return url;
    url = url.replace('webapi.tv4play','api.tv4play');
    if (getUrlParam(url,'operationName') == 'cdp') {
        url = Tv4.makeShowLink(JSON.parse(getUrlParam(url,'variables')).nid);
    }
    if (url.match(/api.tv4play.se.+&node_nids=([^&]+)$/))
        url = Tv4.makeShowLink(url.match(/api.tv4play.se.+&node_nids=([^&]+)$/)[1]);
    if (url.match(/imageproxy.b17g.services/)) {
        var source = getUrlParam(url, 'source');
        var width = getUrlParam(url, 'resize').split('x')[0];
        url = Tv4.fixThumb(source, width/THUMB_WIDTH);
    }
    if (url.match(/graphql.tv4play.se\/graphql\?query/))
        url = Tv4.upgradeOldGraphql(url);
    return url;
};

Tv4.upgradeOldGraphql = function(url) {
    var query = getUrlParam(url, 'query');
    // Can only upgrade shows
    var nid = query.match(/query{program\(nid:"([^"]+)/);
    nid = nid && nid[1];
    if (nid && Tv4.failedUpgrades.indexOf(nid) == -1) {
        if (!Tv4.token) {
            var token = Tv4.getRefreshToken();
            if (token && !token.match(/\.\.\./))
                Tv4.login();
        }
        var data = httpRequest(TV4_API_BASE,
                               {sync: true,
                                headers: Tv4.getHeaders(),
                                params: Tv4.getListSearchQuery(nid, 'SERIES', 100)
                               }
                              ).data;
        data = JSON.parse(data).data.listSearch.items || [];
        for (var i in data) {
            if (data[i].slug == nid)
                return Tv4.makeShowLink(data[i].id);
        }
        alert('Failed to upgrade ' + nid + ' ' + JSON.stringify(data));
        Tv4.failedUpgrades.push(nid);
    }
    return url;
};

Tv4.decodeMain = function(start, extra) {
    start = JSON.parse(start.responseText).data.page.content.panels;
    var panelId = null;
    for (var i in start) {
        if (!start[i].title) continue;
        if (start[i].title.match(/^popul.* just nu/i)) {
            panelId = start[i].id;
        } else if (!panelId && start[i].title.match(/^popul/i)) {
            panelId = start[i].id;
        } else if (start[i].title.match(/^lives/i)) {
            Tv4.live_id = start[i].id;
        }
    }
    if (panelId) {
        requestUrl(TV4_API_BASE,
                   function(status, data, url) {
                       data = JSON.parse(data.responseText).data.panel.content.items;
                       var recommended = Tv4.decodeRecommended(start);
                       start = null;
                       extra = {recommended:recommended};
                       Tv4.decodeShows(data, extra);
                   },
                   {cbComplete: extra.cbComplete,
                    refresh:extra.refresh,
                    headers: Tv4.getHeaders(),
                    postData: Tv4.getPanelQuery(panelId)
                   }
                  );
    } else {
        Tv4.decodeRecommended(start);
        extra.cbComplete && extra.cbComplete();
    }
};

Tv4.getCollectionThumbs = function(ids, cb) {
    if (Tv4.collections) return cb && cb();
    Tv4.collections = {};
    Tv4.getPanelThumbs(ids, Tv4.collections, cb);
};

Tv4.getSectionThumbs = function(id, ids, cb) {
    if (Tv4.thumbs[id]) return cb && cb();
    Tv4.thumbs[id] = {};
    Tv4.getPanelThumbs(ids, Tv4.thumbs[id], cb);
};

Tv4.getCategoryThumbs = function(id, cb) {
    if (Tv4.thumbs[id]) return cb && cb();
    Tv4.thumbs[id] = {};
    httpRequest(TV4_API_BASE,
                {cb: function(status,data) {
                    data = JSON.parse(data).data.page.content.panels;
                    var panelIds = [];
                    for (var i in data) {
                        data[i].id && panelIds.push(data[i].id);
                    }
                    data = null;
                    Tv4.getPanelThumbs(panelIds, Tv4.thumbs[id], cb);
                },
                 headers: Tv4.getHeaders(),
                 params: Tv4.getPageQuery(id)
                }
               );
};

Tv4.getPanelThumbs = function(ids, storage, cb) {
    var answers = ids.length;
    for (var i in ids) {
        var query;
        if (ids[i].is_live)
            query = Tv4.getLivePanelQuery(ids[i].id,10);
        else
            query = Tv4.getPanelQuery(ids[i],10);
        httpRequest(TV4_API_BASE,
                    {cb: function(status,data,xhr,url,params) {
                        answers -= 1;
                        var id = JSON.parse(params).variables.panelId;
                        data = JSON.parse(data).data.panel;
                        var isLive = data.__typename && data.__typename.match(/live/i);
                        data = data.content && data.content.items;
                        if (data && data.length > 0) {
                            for (var j in data) {
                                for (var k in data[j]) {
                                    if (data[j][k].upsell) continue;
                                    if (data[j][k].images) {
                                        storage[id] = {images: data[j][k].images};
                                        break;
                                    }
                                }
                                if (storage[id]) {
                                    if (isLive && Tv4.live_panels.indexOf(id) == -1)
                                        Tv4.live_panels.push(id);
                                    data = null;
                                    break;
                                }
                            }
                        }
                        if (answers == 0 && cb) cb();
                    },
                     headers: Tv4.getHeaders(),
                     params: query
                    }
                   );
    }
};

Tv4.decodeSection = function(data, extra) {
    if (extra.is_related) return Tv4.decodeRelated(data,extra);

    data = JSON.parse(data.responseText).data;
    if (data.menu) return Tv4.decodeClipsMenu(data.menu.items, extra);

    data = data.page;
    var id = data.id;
    var panelIds = [];
    var liveRegexp = new RegExp('(^live)|(- live)', 'i');
    data = data.content.panels;
    for (var i in data) {
        if (data[i].title && liveRegexp.test(data[i].title))
            panelIds.push({id:data[i].id, is_live:true});
        panelIds.push(data[i].id);
    }
    Tv4.getSectionThumbs(id, panelIds, function() {
        if (!isRequestStillValid(extra.requestedLocation)) return;
        var param;
        Tv4.decodeRecommended(data);
        for (var i in data) {
            if (!Tv4.thumbs[id] || !Tv4.thumbs[id][data[i].id]) continue;
            var Thumb = Tv4.thumbs[id][data[i].id].images;
            param = 'panel_id';
            if (Tv4.live_panels.indexOf(data[i].id) != -1)
                param = 'live_panel_id';
            categoryToHtml(data[i].title,
                           Tv4.fixThumb(Thumb),
                           Tv4.fixThumb(Thumb, DETAILS_THUMB_FACTOR),
                           addUrlParam(addUrlParam(extra.url, param, data[i].id),
                                       'limit',
                                       100
                                      )
                          );
        }
        extra.cbComplete && extra.cbComplete();
    });
};

Tv4.decodeClipsMenu = function(data, extra)  {
    var pages = [];
    for (var i in data) {
        if (!data[i].images)
            pages.push(data[i].id);
    }
    Tv4.getPageThumbs(pages, function() {
        for (var i in data) {
            if (!Tv4.pages[data[i].id]) continue;
            Tv4.pageToHtml(data[i]);
        }
        extra.cbComplete && extra.cbComplete();
    });
};

Tv4.checkPages = function(data, cb) {
    var pages = [];
    for (var i in data) {
        if (data[i].page && !data[i].page.images)
            pages.push(data[i].page.id);
    }
    if (pages.length > 0)
        Tv4.getPageThumbs(pages, cb);
    else
        cb && cb()
};

Tv4.getPageThumbs = function(pages, cb) {
    var answers = pages.length;
    for (var i in pages) {
        if (Tv4.pages[pages[i]]) {
            answers -= 1;
            if (answers == 0 && cb) return cb();
            continue;
        }
        httpRequest(TV4_API_BASE,
                    {cb: function(status,data,xhr,url,params) {
                        var id = JSON.parse(params).variables.pageId;
                        data = JSON.parse(data).data.page.content.panels;
                        var panelIds = [];
                        for (var i in data) {
                            panelIds.push(data[i].id);
                        }
                        Tv4.getSectionThumbs(id, panelIds, function() {
                            answers -= 1;
                            if (Tv4.thumbs[id]) {
                                for (var j in Tv4.thumbs[id]) {
                                    Tv4.pages[id] = Tv4.thumbs[id][j];
                                    break;
                                }
                            }
                            if (answers == 0 && cb) return cb();
                        });
                    },
                     headers: Tv4.getHeaders(),
                     params: Tv4.getPageQuery(pages[i])
                    }
                   );
    }
};

Tv4.decodeCategories = function(data, extra) {
    try {
        switch (Tv4.getCategoryIndex().current) {
        case 0:
            var categories = [];
            data = JSON.parse(data.responseText).data.pageList.content;
            for (var i in data) {
                if (data[i].pageReference) {
                    data[i] = data[i].pageReference;
                    categories.push({title: data[i].title,
                                     thumb: data[i].images,
                                     id   : data[i].id
                                    });
                }
            }
            categories.sort(function(a, b) {
                if (a.title.toLowerCase() > b.title.toLowerCase())
                    return 1;
                else
                    return -1;
            });
            for (var k in categories) {
                categoryToHtml(categories[k].title,
                               Tv4.fixThumb(categories[k].thumb),
                               Tv4.fixThumb(categories[k].thumb, DETAILS_THUMB_FACTOR),
                               Tv4.makeCategoryLink(categories[k].id)
                              );
	    }
            data = null;
            extra.cbComplete && extra.cbComplete();
            break;

        case 1:
            data = JSON.parse(data.responseText).data.page.content.panels;
            var panelIds = [];
            for (var j in data) {
                data[j].id && panelIds.push(data[j].id);
            }
            Tv4.getCollectionThumbs(panelIds, function() {
                for (var i in data) {
                    if (!isRequestStillValid(extra.requestedLocation)) return;
                    if (!Tv4.collections[data[i].id]) continue;
                    Thumb = Tv4.collections[data[i].id].images;
                    categoryToHtml(data[i].title,
                                   Tv4.fixThumb(Thumb),
                                   Tv4.fixThumb(Thumb, DETAILS_THUMB_FACTOR),
                                   addUrlParam(extra.url, 'panel_id', data[i].id)
                                  );
                }
                data = null;
                extra.cbComplete && extra.cbComplete();
            });
            break;

        case 2:
            Tv4.decodeAllShows(data, extra, '[]');
            break;
        }
    } catch(err) {
        Log('Tv4.decodeCategories Exception:' + err.message + ' data:' + JSON.stringify(data));
    }
};

Tv4.decodeCategoryDetail = function(data, extra) {
    data = JSON.parse(data.responseText).data;
    if (data.page) {
        var id = data.page.id;
        Tv4.getCategoryThumbs(id, function() {
            if (!isRequestStillValid(extra.requestedLocation)) return;
            data = data.page.content.panels;
            Tv4.decodeRecommended(data);
            for (var i in data) {
                if (!Tv4.thumbs[id][data[i].id])
                    continue;
                categoryToHtml(data[i].title,
                               Tv4.fixThumb(Tv4.thumbs[id][data[i].id]),
                               Tv4.fixThumb(Tv4.thumbs[id][data[i].id], DETAILS_THUMB_FACTOR),
                               addUrlParam(addUrlParam(extra.url, 'panel_id', data[i].id),
                                           'limit',
                                           100
                                          )
                              );
            }
            extra.cbComplete && extra.cbComplete();
        });
    } else if (data.panel) {
        // Collections
        data = data.panel.content;
        Tv4.checkPages(data.items, function() {
            Tv4.decodeShows(data.items, extra);
        });
    } else {
        data = data.listSearch || data.search;
        // Search panels.
        if (JSON.parse(extra.postData).variables.input.types[0] == 'SERIES')
            Tv4.decodeShows(data.items, extra);
        else
            Tv4.decode(data.items, extra);
    }
};

Tv4.decodeLive = function(channels, extra) {
    channels = JSON.parse(channels.responseText).data.channels;
    for (var k in channels) {
        if (!channels[k].access.hasAccess) continue;
        channels[k].isChannel = true;
        var item = Tv4.decodeVideo(channels[k], extra);
        if (item) toHtml(item);
    }
    extra.cbComplete && extra.cbComplete();
};

Tv4.useLiveRefresh = function() {
    return true;
};

Tv4.decodeShowList = function(data, extra) {
    var cbComplete = extra.cbComplete;
    var UserData = extra.user_data && JSON.parse(extra.user_data);
    var panels = UserData && UserData.panels;
    var showThumb = UserData && UserData.show_thumb;
    var showId    = UserData && UserData.show_id;
    extra.upcoming = UserData && UserData.upcoming;

    if (extra.is_related) return Tv4.decodeRelated(data,extra);

    if (extra.is_clips) {
        // TODO has_next
        data = JSON.parse(data.responseText).data.panel.content.items;
        return Tv4.decode(data, extra);
    }

    // 0 Means the only season
    if (!extra.season && extra.season != 0) {
        if (!extra.is_json)
            data = JSON.parse(data.responseText).data.media;
        var seasons = [];
        // var non_seasons = [];
        var season;
        var seasonName;
        var seasonId;
        // var all_items_url;
        var upcoming = data.upcomingEpisode;
        var label = Tv4.getLabel(data);
        if (label)
            label = {recurringBroadcast:label};
        showId = data.id;
        Tv4.saveShow(showId, data.images, label);
        if (!Tv4.shows[showId].empty_seasons) {
            return Tv4.saveSeasons(data.allSeasonLinks, showId, function() {
                if (isRequestStillValid(extra.requestedLocation)) {
                    extra.is_json = true;
                    Tv4.decodeShowList(data, extra);
                }
            });
        }
        showThumb = Tv4.fixThumb(data);
        panels = data.hasPanels && data.panels.items;
        if (upcoming) upcoming.is_upcoming = true;
        // TODO - non-season still valid?
        // Find seasons and non-seasons
        for (var k in data.allSeasonLinks) {
            seasonId = data.allSeasonLinks[k].seasonId;
            if (Tv4.shows[showId].empty_seasons.indexOf(seasonId) != -1)
                continue;
            // all_items_url = Tv4.makeApiLink('videoPanel(id:"' + data[k].id + '"){' + VIDEO_LIST_PARAMS + '}');
            // if (data[k].assetType != 'CLIP') {
            //     if (data[k].videoList.totalHits == 0)
            //         continue;
            //     season = data[k].videoList.videoAssets[0].season;
            seasonName = data.allSeasonLinks[k].title || " ";
            season = seasonName.match(/song ([0-9]+)/);
            season = (season && season[1]) || (k+1);
            seasons.push({name     : seasonName,
                          url      : addUrlParam(TV4_API_BASE,
                                                 'season_id',
                                                 seasonId
                                                ),
                          season   : +season,
                          upcoming : upcoming && upcoming.seasonTitle == seasonName && upcoming
                         });
            // } else {
            //     non_seasons = non_seasons.concat(data[k].videoList.videoAssets);
            // }
        }
        seasons.sort(function(a, b){
            return b.season-a.season;
        });
        if (seasons.length > 1) {
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
            UserData = JSON.stringify({show_thumb : showThumb,
                                       show_id    : data.id,
                                       panels     : panels,
                                       upcoming   : seasons[0].upcoming
                                      });
            return callTheOnlySeason(seasons[0].name, seasons[0].url, extra.loc, UserData);
        } else if (upcoming) {
            extra.upcoming = upcoming;
            extra.cbComplete = null;
            Tv4.decode([], extra);
        }
        // } else if (non_seasons.length) {
        //     Tv4.decode(non_seasons, extra);
        // }

    } else {
        var episodes;
        var seasonId;
        data = JSON.parse(data.responseText).data.season;
        seasonId = data.id;
        data = data.episodes;
        episodes = data.items;
        while (data.pageInfo.hasNextPage) {
            data = httpRequest(TV4_API_BASE,
                               {headers: Tv4.getHeaders(),
                                params: Tv4.getSeasonQuery(seasonId,
                                                           data.pageInfo.nextPageOffset
                                                          ),
                                sync: true
                               }
                              );
            data = JSON.parse(data.data).data.season.episodes;
            episodes = episodes.concat(data.items);
        }
        extra.cbComplete = null;
        Tv4.decode(episodes, extra);
    }

    if (!extra.season) {
        Tv4.addClips(panels, showId, showThumb);
        relatedToHtml(showThumb, addUrlParam(TV4_API_BASE,
                                             'related_id',
                                             showId
                                            )
                     );
    }
    cbComplete && cbComplete();
};

Tv4.saveSeasons = function(seasons, showId, cb) {
    var answers = seasons.length;
    Tv4.shows[showId].empty_seasons = [];
    if (seasons.length == 0 && cb) return cb();
    for (var k in seasons) {
        httpRequest(TV4_API_BASE,
                    {cb: function(status,data,xhr,url,params) {
                        var any_access = false;
                        var date = getCurrentDate();
                        var id;
                        answers -= 1;
                        data = JSON.parse(data).data.season;
                        id = data.id;
                        data = data.episodes.items;
                        for (var i in data) {
                            if (Tv4.isViewable(data[i], {strip_show:true}, false, date)) {
                                any_access = true;
                                break;
                            }
                        }
                        if (!any_access)
                            Tv4.shows[showId].empty_seasons.push(id);

                        if (answers == 0 && cb) cb();
                    },
                     headers: Tv4.getHeaders(),
                     params: Tv4.getSeasonQuery(seasons[k].seasonId)
                    }
                   );
    }
};

Tv4.addClips = function(Panels, ShowId, ShowThumb) {
    if (Panels) {
        for (var c in Panels) {
            clipToHtml(ShowThumb,
                       addUrlParam(addUrlParam(TV4_API_BASE, 'show_id', ShowId),
                                   'clip_id',
                                   Panels[c].id
                                  ),
                       Panels[c].title
                      );
        }
    }
};

Tv4.decodeSearchList = function(data, extra) {
    if (extra.query.length == 1) {
        Tv4.decodeAllShows(data, extra, '["'+extra.query+'"]');
    } else {
        var cbComplete = extra.cbComplete;
        var hits = {};
        var searches = [];
        extra.cbComplete = null;
        data = JSON.parse(data.responseText).data.listSearch;
        if (data.items.length > 0)
            hits['SERIES'] = {data:data, title:'Serier'};
        data = null;
        searches = [{title:'Filmer', type:'MOVIE'},
                    {title:'Sport', type:'SPORT_EVENT'},
                    {title:'Klipp', type:'CLIP'}
                   ];
        Tv4.runSearches(searches, extra, hits, function() {
            for (var i in hits) {
                if (i == 'SERIES')
                    Tv4.decodeShows(hits[i].data.items.slice(0,5), extra);
                else
                    Tv4.decode(hits[i].data.items.slice(0,5), extra);
            }
            Tv4.addSearchPanels(hits, extra);
            hits = null;
            cbComplete && cbComplete();
        });
    }
};

Tv4.runSearches = function(searches, extra, hits, cb, i) {
    i = i || 0;
    requestUrl(TV4_API_BASE,
               function(status, data) {
                   data = JSON.parse(data.responseText).data;
                   data = data.listSearch || data.search;
                   if (data.items && data.items.length > 0)
                       hits[searches[i].type] = {data:data, title:searches[i].title};
                   i += 1;
                   if (i < searches.length)
                       Tv4.runSearches(searches, extra, hits, cb, i);
                   else
                       cb && cb();
               },
               {headers : Tv4.getHeaders(),
                postData : Tv4.getListSearchQuery(extra.query, searches[i].type)
               }
              );
};

Tv4.addSearchPanels = function(hits, extra) {
    for (var i in hits) {
        if (hits[i].data.items.length > 5) {
            hits[i].title += ' (' + hits[i].data.pageInfo.totalCount + ')';
            var thumb = Tv4.getNextViewableItem(hits[i].data.items.slice(5));
            categoryToHtml(hits[i].title,
                           Tv4.fixThumb(thumb),
                           Tv4.fixThumb(thumb, DETAILS_THUMB_FACTOR),
                           addUrlParam(addUrlParam(TV4_API_BASE,
                                                   'query',
                                                   extra.query
                                                  ),
                                       'search_type',
                                       i
                                      )
                          );
        }
    }
};

Tv4.getNextViewableItem = function(items) {
    for (var i in items) {
        if (Tv4.isViewable(items[i]))
            return items[i];
    }
};

Tv4.getHeaderPrefix = function() {
    return 'Tv4';
};

Tv4.keyRed = function() {
    if ($('#a-button').text().match(/^Re/)) {
	setLocation('index.html');
    } else if ($('#a-button').text().match(/^sport/i)) {
	setLocation('Sport.html');
    } else if ($('#a-button').text().match(/^[ck]lip/i)) {
	setLocation('Clips.html');
    } else {
	setLocation('News.html');
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

Tv4.getAButtonText = function(language) {

    var loc = getIndexLocation();

    if (loc.match(/index\.html/)) {
        if(language == 'English'){
	    return 'News';
        } else {
	    return 'Nyheter';
        }
    } else if (loc.match(/News\.html/)) {
        return 'Sport';
    } else if (loc.match(/Sport\.html/)) {
        if(language == 'English'){
	    return 'Clips';
        } else {
	    return 'Klipp';
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

Tv4.getCButtonText = function(language) {
    if(language == 'English')
	return 'Channels';
    else
        return 'Kanaler';
};

Tv4.determineSeason = function(data) {
    var Season = data.extendedTitle || data.seasonTitle;
    Season = Season && Season.match(/s.+song ([0-9]+)/i);
    return Season && +Season[1];
};

Tv4.determineEpisode = function(data) {
    var Episode;
    if (data.extendedTitle)
        Episode = data.extendedTitle.match(/avsnitt ([0-9]+)/i);
    if (!Episode && data.title)
        Episode = data.title.match(/avsnitt ([0-9]+)/i);

    return Episode && +Episode[1];
};

Tv4.epgToTitle = function(epg) {
    if (!epg) return '';
    var title = dateToClock(timeToDate(epg.start)) + '-' + dateToClock(timeToDate(epg.end));
    return title + ' ' + epg.title;
};

Tv4.decodeRecommended = function(data) {
    var titles = [];
    var Link;
    var LinkPrefix;
    var Background;
    var Description;
    var Label;
    var Name;
    var Thumb;
    var Item;
    for (var i in data) {
        if (!data[i].link) continue;
        Description = data[i].shortPitch || data[i].pitch;
        if (data[i].link.series) {
            Name = data[i].link.series.title;
            if (titles.indexOf(Name) != -1) continue;
            titles.push(Name);
            Label = Tv4.getLabel(data[i].link.series);
            Link = Tv4.makeShowLink(data[i].link.series.id);
            LinkPrefix = makeShowLinkPrefix();
            Background = null;
            toHtml({name        : Name,
                    description : Description,
                    label       : Label,
                    link        : Link,
                    link_prefix : LinkPrefix,
                    thumb       : Tv4.fixThumb(data[i]),
                    background  : Background
                   });
        } else if (Tv4.isVideo(data[i].link)) {
            data[i].current = Tv4.getVideoItem(data[i].link);
            data[i].current.is_recommended = true;
            data[i].current.is_sport = (data[i].link.sportEvent != null);
            if (data[i].current.series) {
                titles.push(data[i].current.series.title);
                Tv4.fetchShow(data[i].current.series.id);
            } else {
                titles.push(data[i].current.title);
            }
            data[i].current.description = data[i].shortPitch || data[i].pitch;
            Item = Tv4.decodeVideo(data[i].current);
            if (Item) toHtml(Item);
        } else if (data[i].link.page) {
            data[i].id = data[i].link.page.id;
            Tv4.pageToHtml(data[i], Description);
        } else {
            alert('Unknown item:' + JSON.stringify(data[i]));
        }
    }
    return titles;
};

Tv4.decodeVideo = function(data, CurrentDate, extra) {
    var Name;
    var Duration;
    var IsLive;
    var IsRunning;
    var start;
    var Link;
    var Description;
    var ImgLink;
    var Background;
    var AirDate;
    var Show=null;
    var Season=null;
    var Episode=null;
    var IncludeUpcoming=false;

    extra = extra || {};
    CurrentDate = CurrentDate || getCurrentDate();
    data = data.clip || data;
    Name = data.title.trim();

    if (data.series) {
        Show = data.series.title;
        // if (!Show && data.program.id)
        //     Show = data.program.id.capitalize();
    } else
        Show = null;

    IsLive = data.isLiveContent && !Tv4.hasEnded(data, CurrentDate);
    IncludeUpcoming = data.is_recommended || extra.is_live || IsLive;
    if (!Tv4.isViewable(data, extra, IncludeUpcoming, CurrentDate))
        // Premium/DRM
        return null;
    start = data.playableFrom && timeToDate(data.playableFrom.isoString);
    if (!IsLive && !extra.is_live && start && start > CurrentDate) {
        if (data.is_sport)
            IsLive = true;
        else if (data.is_recommended)
            data.is_upcoming = true
    }
    start = (start && (IsLive || data.is_upcoming)) ? start : null;
    IsRunning = IsLive && start && (CurrentDate > start);
    Description = data.synopsis && data.synopsis.medium || data.description || '';
    if (extra.strip_show) {
        Name = Name.split('-');
        if (Name.length > 1) {
            Description = Name[1].trim();
        }
        Name = Name[0].trim();
    } else if (Show && !Name.match(Show)) {
        Name = Show + ' - ' + Name;
    };
    ImgLink = Tv4.fixThumb(data);
    Background = Tv4.fixThumb(data, BACKGROUND_THUMB_FACTOR);
    Duration = data.video && data.video.duration;
    Duration = Duration && Duration.seconds;
    Link = Tv4.makeVideoLink(data);
    AirDate = data.playableFrom && data.playableFrom.isoString;
    Season  = Tv4.determineSeason(data);
    Episode = data.title.match(/avsnitt ([0-9]+)/i);
    Episode = Episode && +Episode[1];

    if (data.epg && data.epg.length > 0) {
        data.isChannel = true;
        var end = timeToDate(data.epg[0].end);
        start = timeToDate(data.epg[0].start);
        Duration = Math.round((end-start)/1000);
        Name = dateToClock(start) + '-' + dateToClock(end) + ' ' + data.epg[0].title;
        Name = data.title + ' ' + Name;
        ImgLink = Tv4.fixThumb(data.epg[0]);
        Background = Tv4.fixThumb(data.epg[0], BACKGROUND_THUMB_FACTOR);
        Description = Tv4.epgToTitle(data.epg[1]);
    }

    // alert('Season: '+ Season + ' Episode: ' + Episode + ' Name:' + Name);
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
            is_channel:data.isChannel,
            start:start,
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

        if (extra.upcoming) {
            var duplicate = false;
            for (var i in data) {
                if (extra.upcoming.id == data[i].id) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) data.unshift(extra.upcoming);
        }

        for (var k in data) {
            Item = Tv4.decodeVideo(data[k], getCurrentDate(), extra);
            if (!Item)
                continue;
            Tv4.result.push(Item);
        }

        if (extra.strip_show && !extra.is_clips) {
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

        for (var j in Tv4.result) {
            toHtml(Tv4.result[j]);
	}
        data = null;
        Tv4.result = [];
    } catch(err) {
        Log('Tv4.decode Exception:' + err.message + ' data:' + JSON.stringify(data));
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

Tv4.decodeRelated = function(data, extra) {
    data = JSON.parse(data.responseText).data.media.recommendations.items;
    extra.strip_show = false;
    Tv4.decodeShows(data, extra);
    data = null;
};

Tv4.decodeShows = function(data, extra) {
    try {
        var Name;
        var LinkPrefix;
        var Link;
        var Background;
        var IsMovie;
        var VideoItem;
        var recommended = extra.recommended || [];

        Tv4.result = [];
        for (var k in data) {
            if (Tv4.isVideo(data[k])) {
                data[k].current = Tv4.getVideoItem(data[k]);
                if (data[k].current && data[k].current.upsell) continue;
                if (recommended.indexOf(data[k].current.title) != -1)
                    // Duplicate
                    continue;
                VideoItem = Tv4.decodeVideo(data[k].current,
                                            getCurrentDate(),
                                            extra
                                           );
                if (VideoItem) {
                    if (!VideoItem.show || recommended.indexOf(VideoItem.show) == -1) {
                        VideoItem.is_movie = true;
                        Tv4.result.push(VideoItem);
                    }
                }
                continue;
            } else if (data[k].page) {
                Tv4.result.push({is_page:true, page:data[k].page});
                continue;
            }
            if (data[k].series)
                data[k] = data[k].series;
            if (data[k].upsell) continue;
            Name = data[k].title;

            if (recommended.indexOf(Name) != -1)
                // Duplicate
                continue;

            Link = Tv4.makeShowLink(data[k].id);
            Tv4.result.push({name        : Name,
                             // description : data[k].description,
                             label       : Tv4.getLabel(data[k]),
                             link_prefix : LinkPrefix,
                             link        : Link,
                             thumb       : Tv4.fixThumb(data[k].images)
                            });
            recommended.push(Name);
        }
        data = null;

        if (extra.sort) {
            Tv4.result.sort(function(a, b) {
                if (a.name.toLowerCase() > b.name.toLowerCase())
                    return 1;
                else
                    return -1;
            });
        }

        for (var l in Tv4.result) {
            if (Tv4.result[l].is_movie)
                toHtml(Tv4.result[l]);
            else if (Tv4.result[l].is_page)
                Tv4.pageToHtml(Tv4.result[l].page);
            else
                showToHtml(Tv4.result[l].name,
                           Tv4.result[l].thumb,
                           Tv4.result[l].link,
                           null,
                           Tv4.result[l].label
                          );
        }

        Tv4.result = [];
    } catch(err) {
        Log('Tv4.decodeShows Exception:' + err.message);
    }
    if (extra.cbComplete)
        extra.cbComplete();

    return recommended;
};

Tv4.decodeAllShows = function(data, extra, filter, cbComplete) {
    cbComplete = cbComplete || extra.cbComplete;
    extra.cbComplete = null;
    data = JSON.parse(data.responseText).data.mediaIndex.contentList;
    var nextOffset = data.pageInfo.nextPageOffset;
    if (nextOffset > 0) {
        requestUrl(TV4_API_BASE,
                   function(status, data) {
                       Tv4.decodeAllShows(data,extra,filter,cbComplete);
                   },
                   {headers : Tv4.getHeaders(),
                    postData : Tv4.getAllShowsQuery(filter,nextOffset)
                   }
                  );
    }
    Tv4.decodeShows(data.items, extra);
    data = null;
    if (nextOffset == 0)
        cbComplete && cbComplete();
};

Tv4.pageToHtml = function(page, Description) {
    var thumb = page.images || Tv4.pages[page.id];
    categoryToHtml(page.name || page.title,
                   Tv4.fixThumb(thumb),
                   Tv4.fixThumb(thumb, DETAILS_THUMB_FACTOR),
                   addUrlParam(TV4_API_BASE, 'page_id', page.id),
                   null,
                   Description
                  );
};

Tv4.isVideo = function(data) {
    return (Tv4.getVideoItem(data)) ? true : false;
};

Tv4.getVideoItem = function(data) {
    if (data.channel) data.channel.isChannel = true;
    return data.movie || data.clip || data.clipVideo || data.video || data.channel || data.episode || data.sportEvent;
};

Tv4.getDetailsData = function(url, data, user_data) {
    var Name='';
    var Title = Name;
    var DetailsImgLink='';
    var AirDate='';
    var Start=null;
    var VideoLength = '';
    var AvailDate=null;
    var Description;
    var NotAvailable=false;
    var isLive=false;
    var Show=null;
    var Season=null;
    var Episode=null;
    var EpisodeName = null;
    var Related;
    try {
        // alert(JSON.stringify(JSON.parse(data.responseText)));
        data = JSON.parse(data.responseText).data.media;
        if (data.allSeasonLinks)
            return Tv4.getShowData(url, data, user_data);
        if (!data.video) data.video = data.clipVideo;

        Name = data.title;
        Title = Name;
	DetailsImgLink = Tv4.fixThumb(data.images, DETAILS_THUMB_FACTOR);
        Description = data.synopsis && data.synopsis.medium;
        Description = Description || data.description || '';
        AirDate = data.playableFrom && timeToDate(data.playableFrom.isoString);
        AvailDate = data.playableUntil && timeToDate(data.playableUntil.isoString);
        NotAvailable = ((AirDate - getCurrentDate()) > 60*1000);
        if (data.video) {
            VideoLength = dataLengthToVideoLength(null, data.video.duration.seconds);
            isLive = data.video.isLiveContent && !Tv4.hasEnded(data.video);
        } else {
            isLive = !Tv4.hasEnded(data);
            if (data.isLiveContent && data.liveEventEnd) {
                VideoLength = timeToDate(data.liveEventEnd.isoString) - AirDate;
                VideoLength = dataLengthToVideoLength(null,Math.round(VideoLength/1000));
            }
        }
        if (data.epg && data.epg.length > 0) {
            Start = timeToDate(data.epg[0].start);
            var end   = timeToDate(data.epg[0].end);
            DetailsImgLink = Tv4.fixThumb(data.epg[0], DETAILS_THUMB_FACTOR);
            VideoLength = Math.round((end-Start)/1000);
            VideoLength = dataLengthToVideoLength(null,VideoLength);
            AirDate = dateToClock(Start) + '-' + dateToClock(end);
            Name = data.title + ' - ' + data.epg[0].title;
            Title = AirDate + ' ' + Name;
            Description = data.epg[0].synopsis.medium + '<br>';
            data.epg = data.epg.slice(1);
            for (i in data.epg) {
                Description += '<br>' + Tv4.epgToTitle(data.epg[i]);
            }
        } else if (data.series || data.parent) {
            Show = data.series || data.parent;
            Tv4.fetchShow(Show.id);
            Show.label = Tv4.shows[Show.id] && Tv4.shows[Show.id].label;
            Show.images = Tv4.shows[Show.id] && Tv4.shows[Show.id].images;
            Show = {name  : Show.title,
                    label : Tv4.getLabel(Show),
                    url   : Tv4.makeShowLink(Show.id),
                    thumb : Tv4.fixThumb(Show.images)
                   };
        } else if (data.video && data.video.duration.seconds > (10*60)) {
            // Assume movie
            Show = {name        : Name,
                    url         : Tv4.makeVideoLink(data),
                    thumb       : DetailsImgLink,
                    large_thumb : Tv4.fixThumb(data, BACKGROUND_THUMB_FACTOR),
                    is_movie    : true
                   };
            Related = Tv4.makeRelatedLink(data.id);
        }
        Season = Tv4.determineSeason(data);
        Episode = Tv4.determineEpisode(data);
        if (!Season) {
            Season = getUrlParam(myLocation,'history');
            Season = Season && Season.match(/.*\/([^/]+)\/$/);
            Season = Season && decodeURIComponent(Season[1]);
        }
        alert('Season: '+ Season + ' Episode: ' + Episode + ' Name:' + Name);
        EpisodeName = data.title;
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
            start         : Start || AirDate,
            duration      : VideoLength,
            description   : Description,
            not_available : NotAvailable,
            thumb         : DetailsImgLink,
            season        : Season,
            episode       : Episode,
            episode_name  : EpisodeName,
            parent_show   : Show,
            related       : Related
    };
};

Tv4.getShowData = function(url, data, user_data) {
    var Name='';
    var Genre = [];
    var DetailsImgLink='';
    var Description='';
    var Related;

    try {
        Name = data.title;
        Description = data.synopsis.long || data.synopsis.brief;
	DetailsImgLink = Tv4.fixThumb(data.images, DETAILS_THUMB_FACTOR);
        Genre = data.genres && data.genres.join('/');
        Related = !user_data && Tv4.makeRelatedLink(data.id);
    } catch(err) {
        Log('Tv4.getShowData exception:' + err.message);
        Log('Name:' + Name);
        Log('Genre:' + Genre);
        Log('Description:' + Description);
        Log('DetailsImgLink:' + DetailsImgLink);
    }
    data = null;
    return {show        : true,
            name        : Name,
            description : Description,
            genre       : Genre,
            thumb       : DetailsImgLink,
            related     : Related
           };
};

Tv4.getShowUrl = function(url) {
    return Tv4.getUrl();
};

Tv4.getDetailsUrl = function(streamUrl) {
    var id = getUrlParam(streamUrl, 'show_id');
    if (id) {
        var is_clips = getUrlParam(streamUrl, 'clip_id');
        streamUrl = Tv4.postToGet(Tv4.getShowQuery(id));
        if(is_clips)
            streamUrl = addUrlParam(streamUrl, 'my_user_data', 'is_clips');
        return streamUrl;
    }
    id = getUrlParam(streamUrl, 'video_id');
    if (id) {
        return Tv4.postToGet(Tv4.getVideoQuery(id));
    }
    id = getUrlParam(streamUrl,'related_id');
    if (id) {
        return addUrlParam(Tv4.postToGet(Tv4.getShowQuery(id)), 'my_user_data', 'is_related');
    }
    return streamUrl;
};

Tv4.getPlayUrl = function(streamUrl, isLive) {
    var asset = getUrlParam(streamUrl, 'video_id');
    if (!asset) {
        asset = JSON.parse(getUrlParam(streamUrl,'variables')).id;
    }
    var wmdrmUrl = Tv4.makeStreamUrl(asset, 'wmdrm');
    var mpdUrl = Tv4.makeStreamUrl(asset, 'mpd');
    var hlsUrl = Tv4.makeStreamUrl(asset, 'hls', isLive);
    var streams = (isLive) ? [wmdrmUrl,hlsUrl,mpdUrl] : [mpdUrl,wmdrmUrl,hlsUrl];

    Tv4.selectStream(streamUrl,
                     isLive,
                     hlsUrl,
                     streams,
                     function(stream, srtUrl, live, drm, useOffset) {
                         if (!stream) {
                             $('.bottomoverlaybig').html('Not Available!');
                         } else {
                             Resolution.getCorrectStream(RedirectIfEmulator(stream),
                                                         RedirectIfEmulator(srtUrl),
                                                         {useBitrates:true,
                                                          license:drm && drm.license,
                                                          customdata:drm && drm.customData,
                                                          isLive:live,
                                                          use_offset:useOffset
                                                         });
                         }
                     }
                    );
};

Tv4.selectStream  = function(streamUrl, isLive, hlsUrl, streams, cb) {
    requestUrl(RedirectIfEmulator(streams[0]),
               function(status, data) {
                   if (Player.checkPlayUrlStillValid(streamUrl)) {
                       // alert(JSON.stringify(JSON.parse(data.responseText)));
                       data = JSON.parse(data.responseText);
                       isLive = isLive || data.metadata.isLive;
                       var use_offset = (data.metadata.type == 'channel');
                       data = data.playbackItem;
                       var stream = Tv4.addStreamingFilter(data.manifestUrl, isLive);
                       use_offset = use_offset || (data.startoverManifestUrl != null);
                       var drm = Tv4.getDrm(data);
                       if (drm && streams.length > 1 && !streams[0].match(/mss/)) {
                           streams.shift();
                           return Tv4.selectStream(streamUrl, isLive, hlsUrl, streams, cb);
                       }
                       streams.shift();
                       if (!isLive) {
                           Tv4.getSrtUrl(data,
                                         hlsUrl,
                                         function(srtUrl) {
                                             cb(stream, srtUrl, isLive, drm);
                                         }
                                        );
                       } else {
                           // Use offset for live shows with 'startOver'
                           cb(stream, null, isLive, drm, use_offset);
                       }
                   }
               },
               {headers:Tv4.getHeaders(),
                dont_show_errors: streams.length > 1,
                cbError:function(status, data) {
                    if (streams.length > 1) {
                        streams.shift();
                        Tv4.selectStream(streamUrl, isLive, hlsUrl, streams, cb);
                    } else {
                        Tv4.popUpError(data);
                        Log('Tv4.getPlayUrl something went wrong: ' + data.responseText);
                    }
                }
               }
              );
};

Tv4.getDrm = function(data) {
    var license = data.license && data.license.castlabsServer;
    var customData = data.license && data.license.castlabsToken;
    if (customData) {
        data.auth = JSON.parse(JSON.parse(atob(customData.split('.')[1])).optData);
        data.auth.authToken = customData;
        customData = btoa(JSON.stringify(data.auth));
    }
    if (license && customData)
        return {license:RedirectIfEmulator(license), customData:customData};
    else
        return null;
};

Tv4.addStreamingFilter = function(stream, isLive) {
    if (isLive) return stream;
    return addUrlParam(stream,
                       'filter',
                       '(type=="video" || ((count(type=="audio") > 1 && (systemLanguage=="eng" || systemLanguage=="swe")) || (count(type=="audio")==1 && type=="audio")))'
                      );
};

Tv4.makeStreamUrl = function(asset, Type, isLive) {
    var protocol;
    switch (Type) {
    case 'wmdrm':
        protocol = '&device=samsung-orsay&protocol=mss';
        break;
    case 'mpd':
        protocol = '&device=browser&protocol=dash';
        break;
    case 'hls':
        protocol = '&device=browser&protocol=hls&is_live=' + Boolean(isLive);
        break;
    }
    return 'https://playback2.a2d.tv/play/' + asset + '?service=tv4play&drm=playready' + protocol;
};

Tv4.getSrtUrl = function (data, hlsUrl, cb) {
    data = data && (data.subtitles || data.subs);
    if (data) {
        for (var i in data) {
            if (data[i].language=="sv" && data[i].type=="vtt") {
                return cb(data[i].url);
            }
        }
    }
    var srtUrl = null;
    requestUrl(RedirectIfEmulator(hlsUrl),
               function(status, data) {
                   try {
                       if (hlsUrl.match(/protocol=hls/)) {
                           data = JSON.parse(data.responseText).playbackItem.manifestUrl;
                           Tv4.getSrtUrl(null, data, cb);
                       } else {
                           srtUrl = data.responseText.match(/TYPE=SUBTITLES.+URI="([^"]+)/)[1];
                           if (!srtUrl.match(/^http/))
                               srtUrl = getUrlPrefix(hlsUrl) + srtUrl;
                           cb(srtUrl.replace('.m3u8', '.webvtt'));
                       }
                   } catch (err) {
                       Log('No HLS subtitles: ' + err + ' hlsUrl:' + hlsUrl);
                       cb(null);
                   }
               },
               {dont_show_errors: true,
                headers: Tv4.getHeaders(),
                cbError:function() {
                    Log('Failed to fetch HLS subtitles from ' + hlsUrl);
                    cb(null);
                }
               }
              );
};

Tv4.popUpError = function(data) {
    try {
        data = JSON.parse(data.responseText).errorCode;
        data && PopUp(data);
    } catch (err) {
        alert(err);
        return;
    }
};

Tv4.postToGet = function(query) {
    query = JSON.parse(query);
    var url = addUrlParam(TV4_API_BASE, 'query', query.query);
    url = addUrlParam(url, 'variables', JSON.stringify(query.variables));
    return addUrlParam(url, 'operationName', query.operationName);
};

Tv4.fetchShow = function(id) {
    if (Tv4.shows[id]) return;
    httpRequest(TV4_API_BASE,
                {cb: function(status,data) {
                    data = JSON.parse(data).data.media;
                    Tv4.saveShow(id, data.images, data.label);
                    data = null;
                },
                 headers: Tv4.getHeaders(),
                 params: Tv4.getShowQuery(id)
                }
               );
};

Tv4.saveShow = function(id, images, label) {
    // Don't overwrite empty_seasons
    if (Tv4.shows[id]) {
        Tv4.shows[id].images = images;
        Tv4.shows[id].label = label;
    } else {
        Tv4.shows[id] = {images:images, label:label};
    }
};

Tv4.makeCategoryLink = function(id) {
    return addUrlParam(TV4_API_BASE, 'category_id', id);
};

Tv4.makeShowLink = function(id) {
    return addUrlParam(TV4_API_BASE, 'show_id', id);
};

Tv4.makeRelatedLink = function(id) {
    return makeRelatedLink(addUrlParam(TV4_API_BASE,
                                       'related_id',
                                       id
                                      )
                          );
};

Tv4.makeVideoLink = function(data) {
    return addUrlParam(TV4_API_BASE, 'video_id', data.id);
};

Tv4.fixThumb = function(thumb, factor) {
    if (!thumb) return thumb;
    thumb = thumb.images || thumb.image || thumb;
    if (thumb.image16x9 && !thumb.image16x9.sourceEncoded.match(/fallback/))
        thumb = decodeURIComponent(thumb.image16x9.sourceEncoded);
    else if (thumb.main16x9)
        thumb = decodeURIComponent(thumb.main16x9.sourceEncoded);
    else if (thumb.main16x9Annotated && !thumb.main16x9Annotated.sourceEncoded.match(/fallback/))
        thumb = decodeURIComponent(thumb.main16x9Annotated.sourceEncoded);
    else if (thumb.image4x3)
        thumb = decodeURIComponent(thumb.image4x3.sourceEncoded);
    else if (thumb.cover2x3)
        thumb = decodeURIComponent(thumb.cover2x3.sourceEncoded);

    if (!factor) factor = 1;
    var width = Math.round(factor*THUMB_WIDTH);
    return RedirectIfEmulator(addUrlParam('https://imageproxy.a2d.tv/?width=' + width, 'source', thumb));
};

Tv4.decodeThumb = function(thumb) {
    try {
        var encoded = thumb.match(/([^/]+)\.[^/]+$/)[1].replace(/_/g, '/');
        return atob(encoded).match(/source=([^&]+)/)[1];
    } catch (e) {
        return thumb;
    }
};

Tv4.isViewable = function (data, extra, isLive, currentDate) {
    extra = extra || {};
    if (data.video && data.video.access && data.video.access.hasAccess === false)
        return false;
    else if (!extra.strip_show && data.upsell)
        // Want to see upcoming ones for series
        return false;
    else if (data.isDrmProtected && deviceYear < 2012 && !isEmulator)
        return false;
    else {
        if (isLive) {
            // We want to see what's ahead...
            return true;
        } else {
            currentDate = currentDate || getCurrentDate();
            if (data.playableFrom && data.playableFrom.isoString) {
                if (timeToDate(data.playableFrom.isoString) > currentDate) {
                    if (extra.strip_show) {
                        data.is_upcoming = true;
                        return true;
                    } else
                        return false;
                } else
                    return true;
            } else
                return true;
        }
    }
};

Tv4.hasEnded = function(data, currentDate) {
    currentDate = currentDate || getCurrentDate();
    if (data && data.liveEventEnd)
        return timeToDate(data.liveEventEnd.isoString) < currentDate;
    else
        return false;
};

Tv4.getHeaders = function() {
    var Headers = [{key:'client-version', value:'4.0.0'},
                   {key:'client-name', value:'tv4-web'},
                   // {key:'Feature_flag_enable_season_upsell_on_cdp', value:'false'},
                   {key:'content-type', value:'application/json'}
                  ];
    if (Tv4.token)
        Headers.push({key:'Authorization', value: 'Bearer ' + Tv4.token});
    return Headers;
};

Tv4.getLabel = function(label) {
    if (label) {
        if (label.label)
            label = label.label;
        else if (label.upcomingEpisode && label.upcomingEpisode.playableFrom) {
            return getDay(timeToDate(label.upcomingEpisode.playableFrom.isoString));
        };
    }
    return label && (label.recurringBroadcast || label.announcement);
};

Tv4.getClipMenuQuery = function() {
    return '{"query": "query ClipPageMenu{menu(id:\\\"clip-menu\\\") {items { ... on PageLink {id name}}}}","operationName":"ClipPageMenu"}';
};

Tv4.getPageQuery = function(id) {
    return '{"query": "query Page($pageId: ID!, $input: PageContentInput!) {page(id: $pageId) {id title content(input: $input) {pageInfo{...PageInfoFields} panels{... on MediaPanel{id title} ... on SportEventPanel{id title} ... on ClipsPanel{id title} ... on EpisodesPanel{id title} ... on LivePanel{id title} ... on PagePanel{id title} ... on ChannelPanel{id title type} ... on ThemePanel{...ThemePanelFields} ... on SinglePanel{...SinglePanelFields}}}}}fragment ThemePanelFields on ThemePanel{id title pitch images{image16x9{ ...ImageFieldsFull}} link { ... on ThemePanelSeriesLink {series {id title slug genres numberOfAvailableSeasons images{main16x9{...ImageFieldsLight}}}} ... on ThemePanelMovieLink {movie {id title images {main16x9{...ImageFieldsLight}}}} ... on ThemePanelEpisodeLink {episode {id title extendedTitle}} ... on ThemePanelClipLink {clip {id title images{main16x9{...ImageFieldsLight}}}} ... on ThemePanelPageLink {page{id}} ... on ThemePanelSportEventLink {sportEvent {id title league round playableFrom {isoString} images{main16x9{...ImageFieldsLight}}}}} themePanelLinkText: linkText showMetadataForLink subtitle}fragment SinglePanelFields on SinglePanel {id images{image16x9{...ImageFieldsFull}} link{... on SinglePanelPageLink {page {id}} ... on SinglePanelSportEventLink{sportEvent {...SportEventFieldsLight}} ... on SinglePanelSeriesLink {series {...SeriesFieldsLight}} ... on SinglePanelMovieLink{movie {...MovieFieldsLight}} ... on SinglePanelEpisodeLink{episode {...EpisodeFields}} ... on SinglePanelClipLink{clip {...ClipFieldsLight}} ... on SinglePanelChannelLink{channel{...ChannelFields}}} linkText title pitch shortPitch}' + PAGE_INFO_FIELDS + MEDIA_FIELDS + EPISODE_FIELDS + CHANNEL_FIELDS + '", "variables": {"input": {"limit": 100, "offset": 0}, "pageId": "' + id + '"}, "operationName": "Page"}';
};

Tv4.getPanelQuery = function(id, limit) {
    limit = limit || 30;
    return '{"query": "query Panel($panelId: ID!, $offset: Int!, $limit: Int!){panel(id: $panelId){... on ContinueWatchingPanel{id} ... on PagePanel{id content(input:{offset: $offset, limit: $limit}){pageInfo{...PageInfoFields} items{... on PagePanelPageItem{page{...PageListFields}}}}} ... on SportEventPanel{id content(input:{offset: $offset, limit: $limit}){pageInfo{...PageInfoFields} items{sportEvent{...SportEventFieldsLight}}}} ... on ClipsPanel{id title content(input:{offset: $offset, limit: $limit}){pageInfo{...PageInfoFields} items{clip{...ClipFieldsLight}}}} ... on EpisodesPanel{id title content(input:{offset: $offset, limit: $limit}){pageInfo{...PageInfoFields} items{episode{...EpisodeFields} labelText}}} ... on MediaPanel{id slug title content(input:{offset: $offset, limit: $limit}){pageInfo{...PageInfoFields} items{... on MediaPanelMovieItem{movie{...MovieFieldsLight}} ... on MediaPanelSeriesItem{series{...SeriesFieldsLight}}}}} ... on ChannelPanel{id title type content(input:{offset: $offset, limit: $limit}){pageInfo{...PageInfoFields} items{channel{...ChannelFields}}}}}}' + PAGE_INFO_FIELDS + PAGE_LIST_FIELDS + EPISODE_FIELDS + CHANNEL_FIELDS + MEDIA_FIELDS + '","variables":{"limit":' + limit + ',"panelId":"' + id + '","offset":0},"operationName": "Panel"}';
};

Tv4.getLivePanelQuery = function(id, limit) {
    limit = limit || 30;
    return '{"query": "query LivePanel($panelId: ID!, $offset: Int!, $limit: Int!){panel(id: $panelId){ ... on LivePanel{ id title playOutOfView content(input:{offset: $offset, limit: $limit}){ pageInfo{ ...PageInfoFields} items{ ... on LivePanelChannelItem{ channel{ ...ChannelVideoFields}} ... on LivePanelEpisodeItem{ episode{ ...EpisodeVideoFields}} ... on LivePanelMovieItem{ movie{ ...MovieVideoFields}} ... on LivePanelSportEventItem{ sportEvent{ ...SportEventVideoFields}}}}} __typename}}' + PAGE_INFO_FIELDS + CHANNEL_VIDEO_FIELDS + EPISODE_VIDEO_FIELDS + MOVIE_VIDEO_FIELDS + SPORT_VIDEO_FIELDS + IMAGE_LIGHT_FIELDS + VIDEO_FIELDS + '","variables":{"limit":' + limit + ',"panelId":"' + id + '","offset":0},"operationName": "LivePanel"}';
};

Tv4.getShowQuery = function(id) {
    return '{"query": "query ContentDetailsPage($mediaId: ID!, $panelsInput: CdpPanelsInput!) {media(id: $mediaId) {... on SportEvent {id title league isLiveContent isStartOverEnabled synopsis {brief long} playableFrom {isoString} playableUntil{isoString} liveEventEnd{isoString} images{main16x9 {...ImageFieldsFull}} upsell {tierId}} ... on Movie {id title genres isLiveContent isStartOverEnabled liveEventEnd {isoString} playableFrom {isoString} playableUntil{isoString} video {...VideoFields} images{main16x9{...ImageFieldsFull}} synopsis{brief long} label{...LabelFields} panels(input: $panelsInput) {...CdpPanelsFields} hasPanels upsell{tierId}} ... on Series {id title numberOfAvailableSeasons genres upcomingEpisode{...UpcomingEpisodeFields} images{main16x9{...ImageFieldsFull}} synopsis{brief long} allSeasonLinks{seasonId title numberOfEpisodes} label{...LabelFields} panels(input: $panelsInput) {...CdpPanelsFields} hasPanels upsell {tierId}}}}fragment UpcomingEpisodeFields on UpcomingEpisode {id title seasonTitle playableFrom{isoString} image{main16x9 {...ImageFieldsLight}} upsell {tierId}}fragment CdpPanelsFields on CdpPanels {items {... on ClipsPanel {id title}}}' + IMAGE_FIELDS + VIDEO_FIELDS + LABEL_FIELDS + '", "variables": {"panelsInput": {"limit": 100, "offset": 0}, "mediaId": "' + id + '"}, "operationName": "ContentDetailsPage"}';
};

Tv4.getSeasonQuery = function(id, offset) {
    offset = offset || 0;
    return '{"query": "query SeasonEpisodes($input: SeasonEpisodesInput!, $seasonId: ID!){ season(id: $seasonId){ id numberOfEpisodes episodes(input: $input){initialSortOrder pageInfo{ ...PageInfoFields} items{ ...EpisodeFieldsFull}}}}fragment EpisodeFieldsFull on Episode{...EpisodeFields synopsis{medium}  upsell{tierId}}' + PAGE_INFO_FIELDS + EPISODE_FIELDS + IMAGE_LIGHT_FIELDS + VIDEO_FIELDS + '", "variables": {"seasonId":"' + id + '","input":{"limit":100,"offset":' + offset + ', "sortOrder":"DESC"}}, "operationName": "SeasonEpisodes"}';
};

Tv4.getVideoQuery = function(id) {
    return '{"query": "query Video($id: ID!){media(id: $id){... on SportEvent{...SportEventVideoFields} ... on Channel{...ChannelVideoFields} ... on Movie{...MovieVideoFields} ... on Episode{...EpisodeVideoFields} ... on Clip{...ClipVideoFields}}}fragment ClipVideoFields on Clip{id title images{main16x9{...ImageFieldsLight sourceEncoded}} playableFrom{isoString} parent{... on ClipParentSeriesLink{id title} ... on ClipParentMovieLink{id title}} clipVideo: video{ ...VideoFields} description playableUntil{isoString}}' + MOVIE_VIDEO_FIELDS + SPORT_VIDEO_FIELDS + CHANNEL_VIDEO_FIELDS + VIDEO_FIELDS + EPISODE_VIDEO_FIELDS + IMAGE_LIGHT_FIELDS + '", "variables":{"id":"' + id + '"},"operationName":"Video"}';
};

Tv4.getRelatedQuery = function(id) {
    return '{"query": "query MediaRecommendations($mediaId: ID!, $input: MediaRecommendationsInput!) {media(id: $mediaId) {... on Movie {id recommendations(input: $input) {...Recommendations}} ... on Series {id recommendations(input: $input) {...Recommendations}}}}fragment Recommendations on MediaRecommendationsResult {pageInfo {...PageInfoFields} items {... on RecommendedMovie {movie {...MovieFieldsLight}} ... on RecommendedSeries {series {...SeriesFieldsLight}}}}' + PAGE_INFO_FIELDS + MOVIE_FIELDS + SERIES_FIELDS + LABEL_FIELDS + IMAGE_LIGHT_FIELDS + '", "operationName":"MediaRecommendations","variables":{"input":{"limit":100,"offset":0,"types":["SERIES","MOVIE"]},"mediaId":"' + id + '"}}';
};

// Tv4.getCategoryQuery = function() {
//     return '{"query": "query PageList($pageListId: ID!) {pageList(id: $pageListId) {id content {... on PageReferenceItem {pageReference {...PageListFields}} ... on StaticPageItem {staticPage {id title type images {image4x3 {...ImageFieldsFull}}}}}}}fragment PageListFields on PageReference {id title images {image16x9 {...ImageFieldsFull} image4x3 {...ImageFieldsFull} logo {...ImageFieldsLight isFallback}}}fragment ImageFieldsFull on Image {sourceEncoded meta {muteBgColor {hex}}}fragment ImageFieldsLight on Image {sourceEncoded isFallback}", "variables": {"pageListId": "categories"}, "operationName": "PageList"}';
// };

Tv4.getCategoryQuery = function() {
    return '{"query": "query PageList($pageListId: ID!) {pageList(id: $pageListId) {id content {... on PageReferenceItem {pageReference {...PageListFields}} ... on StaticPageItem {staticPage {id title type images {image4x3 {...ImageFieldsFull}}}}}}}' + PAGE_LIST_FIELDS + IMAGE_FULL_FIELDS + '", "variables": {"pageListId": "categories"}, "operationName": "PageList"}';
};

Tv4.getAllShowsQuery = function(filter, offset) {
    filter = filter || '[]';
    offset = offset || 0;
    return '{"query": "query MediaIndex($input: MediaIndexListInput!, $genres: [String!]) {mediaIndex(genres: $genres) {contentList(input: $input) {items {... on MediaIndexSeriesItem {series {...SeriesFieldsLight}} ... on MediaIndexMovieItem {movie {...MovieFieldsLight}}} pageInfo {hasMoreForLastLetter totalCount lastLetter nextPageOffset}}}}' + SERIES_FIELDS + MOVIE_FIELDS + LABEL_FIELDS + IMAGE_LIGHT_FIELDS + '", "variables": {"input":{"letterFilters":' + filter + ',"limit":100,"offset":' + offset + '}, "operationName": "PageList"}}';
};

Tv4.getChannelQuery = function() {
    return '{"query":"query Channels{channels{...ChannelFields}}' + CHANNEL_FIELDS + IMAGE_LIGHT_FIELDS + '","operationName":"Channels"}';
};

Tv4.getListSearchQuery = function(query, type, limit) {
    limit = limit || 10;
    // 'CLIP', 'MOVIE', 'SERIES', 'SPORT_EVENT'
    return '{"query": "query ListSearch($input: ListSearchInput!) {listSearch(input: $input) {items {... on Series {...SeriesFieldsLight} ... on Movie {...MovieFieldsLight} ... on Clip {...ClipFieldsLight} ... on SportEvent {...SportEventFieldsLight}} pageInfo {hasNextPage nextPageOffset totalCountHasAccess {...ListSearchCountFields} totalCount}}}fragment ListSearchCountFields on ListSearchCount {clips movies series sportEvents}' + SERIES_FIELDS + MOVIE_FIELDS + SPORT_FIELDS + CLIP_FIELDS + VIDEO_FIELDS + IMAGE_LIGHT_FIELDS + LABEL_FIELDS + '","variables":{"input":{"query":"' + query + '", "limit":' + limit + ',"offset":0,"includeUpsell":false,"types":["' + type + '"]}},"operationName":"ListSearch"}';
};

Tv4.getSearchQuery = function(query) {
    return '{"query":"query PanelSearch($input: PanelSearchInput!, $limit: Int!, $offset: Int!, $shouldFetchMovieSeries: Boolean!, $shouldFetchMovieSeriesUpsell: Boolean!, $shouldFetchClip: Boolean!, $shouldFetchPage: Boolean!, $shouldFetchSportEvent: Boolean!, $shouldFetchSportEventUpsell: Boolean!) {panelSearch(input: $input) {data {movieSeries @include(if: $shouldFetchMovieSeries) {id title content(input: {limit: $limit, offset: $offset}) {items {... on MediaPanelSeriesItem {series {...SeriesFieldsLight}} ... on MediaPanelMovieItem {movie {...MovieFieldsLight}}} pageInfo {...PageInfoFields}}} movieSeriesUpsell @include(if: $shouldFetchMovieSeriesUpsell) {id title content(input: {limit: $limit, offset: $offset}) {items {... on MediaPanelSeriesItem {series {...SeriesFieldsLight}} ... on MediaPanelMovieItem {movie {...MovieFieldsLight}}} pageInfo {...PageInfoFields}}} clip @include(if: $shouldFetchClip) {id title content(input: {limit: $limit, offset: $offset}) {items {clip {...ClipFieldsLight}} pageInfo {...PageInfoFields}}} page @include(if: $shouldFetchPage) {id title content(input: {limit: $limit, offset: $offset}) {items {... on PagePanelPageItem {page {...PageListFields}}} pageInfo {...PageInfoFields}}} sportEvent @include(if: $shouldFetchSportEvent) {id title content(input: {limit: $limit, offset: $offset}) {items {sportEvent {...SportEventFieldsLight}} pageInfo {...PageInfoFields}}} sportEventUpsell @include(if: $shouldFetchSportEventUpsell) {id title content(input: {limit: $limit, offset: $offset}) {items {sportEvent {...SportEventFieldsLight}} pageInfo {...PageInfoFields}}}} pageInfo {totalCountAll {clips movies pages series sportEvents}} order}}' + PAGE_INFO_FIELDS + PAGE_LIST_FIELDS + MEDIA_FIELDS + '","operationName":"PanelSearch","variables":{"limit":10,"offset":0,"shouldFetchMovieSeries":true,"shouldFetchMovieSeriesUpsell":false,"shouldFetchClip":true,"shouldFetchPage":false,"shouldFetchSportEvent":true,"shouldFetchSportEventUpsell":false,"input":{"query":"' + query + '"}}}';
};

// TODO
// Tv4.requestNextPage = function(url, callback) {
//     requestUrl(url,callback,callback);
// };
