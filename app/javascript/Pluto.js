var PLUTO_VOD_API = 'https://service-vod.clusters.pluto.tv/v4/vod/';
var PLUTO_CHANNEL_API = 'https://service-channels.clusters.pluto.tv/v2/guide/';
var Pluto = {
    token: null,
    categories: [],
    sub_categories: [],
    live_categories: [],
    category_details: [],
    category_detail_max_index: 0,
    main_channels:[],
    channels:[],
    is_proxy_alive: false
};

Pluto.getMainTitle = function () {
    return 'Populärt';
};

Pluto.getSectionTitle = function(location) {
    if (location.match(/Latest.html/))
        return 'Senaste';
    else
        return Pluto.getMainTitle();
};

Pluto.getMainCategoryLink = function() {
    return 'https://service-media-catalog.clusters.pluto.tv/v1/main-categories?includeImages=svg';
};

Pluto.makeCategoryLink = function(id, offset) {
    if (!offset) offset = 30;
    return PLUTO_VOD_API + 'categories/' + id + '/items?offset=' + offset + '&page=1';
};

Pluto.makeLiveLink = function(channels) {
    return addUrlParam(PLUTO_CHANNEL_API + 'timelines?start=' + new Date().toISOString() + '&duration=60',
                       'channelIds',
                       channels.join(',')
                      );
};

Pluto.refreshLiveLink = function(url) {
    return url.replace(/start=[^&]+/,'start=' + new Date().toISOString());
};

Pluto.addPlayUrlParams = function(url) {
    url = addUrlParam(url,'jwt', Pluto.token);
    url = addUrlParam(url,'masterJWTPassthrough', 'true');
    return addUrlParam(url,'serverSideAds', 'false');
};

Pluto.getHeaders = function() {
    if (Pluto.token) {
        return [{key:'authorization', value:'Bearer ' + Pluto.token}];
    } else {
        alert('NO TOKEN!!');
        return null;
    }
};

Pluto.getStartUrl = function() {
    return PLUTO_VOD_API + 'categories?includeItems=false&offset=1000&page=1&sort=number:asc';
};

Pluto.getUrl = function(tag, extra) {
    switch (tag) {
    case 'main':
        return Pluto.getStartUrl();

    case 'section':
        for (var i in Pluto.categories) {
            if (Pluto.categories[i].name.match(/^Nytt/)) {
                return Pluto.makeCategoryLink(Pluto.categories[i].ids[0]);
            }
        }
        break;

    case 'live':
        if (extra.location)
            return Pluto.refreshLiveLink(extra.location);
        return Pluto.makeLiveLink(Pluto.main_channels);

    case 'categories':
        return Pluto.getMainCategoryLink();

    case 'categoryDetail':
        return Pluto.getCategoryDetailsUrl(extra.location);

    case 'searchList':
        return 'https://service-media-search.clusters.pluto.tv/v1/search?q=' + extra.query + '&limit=100';
    };
};

Pluto.getCategoryDetailsUrl = function(location) {
    var DetailIndex = Pluto.getCategoryDetailIndex();
    switch (DetailIndex.current) {
    case 0:
        return location;

    default:
        if (DetailIndex.current > Pluto.category_detail_max_index)
            return Pluto.category_details[0].url; // Lets sort it when response is received.
        return Pluto.category_details[DetailIndex.current].url;
    }
};

Pluto.login = function(cb) {
    Pluto.category_details = [];
    Pluto.category_detail_max_index = 0;
    if (Pluto.isLoggedIn()) {
        // Detect if token has expired.
        httpRequest(Pluto.getStartUrl(),
                    {cb:function(status,data) {
                        data = null;
                        if (!isHttpStatusOk(status)) {
                            Log('Reset Pluto.token');
                            Pluto.token = null;
                        }
                    },
                     headers : Pluto.getHeaders()
                    });
        return cb && cb();
    };
    var url = 'https://boot.pluto.tv/v4/start?appName=web&appVersion=6.11.1-518d6dea293334a5d23e9fd9322e2bfc2744cda3&deviceVersion=111.0.0&deviceModel=web&deviceMake=chrome&deviceType=web&clientID=a53da60a-a9ee-42f2-b081-ca3d840cc578&clientModelNumber=1.0.0';
    httpRequest(url,
                {cb:function(status,data) {
                    Pluto.token = JSON.parse(data).sessionToken;
                    alert('TOKEN: ' + Pluto.token);
                    data = null;
                    Pluto.init(cb);
                }});
};

Pluto.isLoggedIn = function() {
    return (Pluto.token) ? true : false;
};

Pluto.init = function(cb) {
    httpRequest(Pluto.getMainCategoryLink(),
                {cb:function(status,data) {
                    Pluto.initCategories(data);
                    Pluto.initLive();
                    Pluto.checkProxy();
                   cb && cb();
                },
                 headers:Pluto.getHeaders()
                });
};

Pluto.initCategories = function(data) {
    data = JSON.parse(data).data;
    Pluto.categories = [];
    for (var i in data) {
        var ids = [];
        if (!data[i].vodCategories) continue;
        for (var j in data[i].vodCategories)
            ids.push(data[i].vodCategories[j].id);
        Pluto.categories.push({name: data[i].name,
                               ids: ids,
                               thumb: data[i].images[0].path
                              });
    }
    Pluto.sortByName(Pluto.categories);
    httpRequest(Pluto.getStartUrl(),
                {cb:function(status,data) {
                    Pluto.sub_categories = [];
                    data = JSON.parse(data).categories;
                    for (var k in data) {
                        Pluto.sub_categories.push({id: data[k]._id,
                                                   name: data[k].name
                                                  });
                    }
                },
                 headers : Pluto.getHeaders()
                });
};

Pluto.initLive = function() {
    httpRequest(PLUTO_CHANNEL_API + 'categories',
                {cb:function(status,data) {
                    Pluto.live_categories = [];
                    data = JSON.parse(data).data;
                    for (var i in data) {
                        Pluto.live_categories.push({
                            name: data[i].name,
                            ids: data[i].channelIDs,
                            thumb: data[i].images.slice(-1)[0].url
                        });
                    }
                    Pluto.sortByName(Pluto.live_categories);
                },
                 headers : Pluto.getHeaders()
                });
    httpRequest(PLUTO_CHANNEL_API + 'channels?channelIds=&offset=0&limit=1000&sort=number:asc',
                {cb:function(status,data) {
                    Pluto.channels = [];
                    var featured = [];
                    data = JSON.parse(data).data;
                    for (var j in data) {
                        Pluto.channels.push({
                            name: data[j].name,
                            id: data[j].id,
                            thumb: Pluto.fixThumb(data[j])
                        });
                        if (data[j].featured) {
                            featured.push({id: data[j].id,
                                           name: data[j].name,
                                           order: data[j].featuredOrder
                                          });
                        }
                    }
                    featured.sort(function(a,b){
                        return (a.order < b.order) ? -1 : 1;
                    });
                    Pluto.main_channels = [];
                    for (var k in featured) {
                        Pluto.main_channels.push(featured[k].id);
                    }
                },
                 headers : Pluto.getHeaders()
                });
};

Pluto.checkProxy = function() {
    httpRequest('http://' + GetProxyHost() + '/ping/jtnolog',
                {cb:function(status, text) {
                    Pluto.is_proxy_alive = (status == 200);
                },
                 no_log:true
                });
};

Pluto.decodeMain = function(data, extra) {
    data = JSON.parse(data.responseText).categories;
    var recommended;
    for (var i in data) {
        if (data[i].name && data[i].name.match(/Carousel/)) {
            recommended = Pluto.makeCategoryLink(data[i]._id);
            break;
        }
    }
    requestUrl(recommended,
               function(status, data) {
                   var cbComplete = extra.cbComplete;
                   extra.cbComplete = null;
                   extra.result = Pluto.decode(data, extra);
                   extra.cbComplete = cbComplete;
                   for (var i in Pluto.categories) {
                       if (Pluto.categories[i].name.match(/^Popul/)) {
                           Pluto.getCategories(Pluto.categories[i].ids, extra);
                           break;
                       }
                   }
               },
               {headers:Pluto.getHeaders()}
              );
};

Pluto.getCategories = function(ids, extra, offset, cb, result) {
    if (!result) result=[];
    if (ids.length > 0) {
        requestUrl(Pluto.makeCategoryLink(ids[0], offset),
                   function(status, data) {
                       var total = extra.result && extra.result.total_items || 0;
                       extra.has_more = ids.length > 1;
                       extra.result = Pluto.decode(data, extra);
                       total = extra.result.total_items - total;
                       result.push({id:ids[0], items:total});
                       Pluto.getCategories(ids.slice(1), extra, offset, cb, result);
                   },
                   {headers:Pluto.getHeaders()}
                  );
    } else {
        cb && cb(extra, result);
    }
};

Pluto.decodeSection = function(data, extra) {
    for (var i in Pluto.categories) {
        if (Pluto.categories[i].name.match(/^Nytt/)) {
            extra.links = [];
            Pluto.getCategories(Pluto.categories[i].ids, extra);
            break;
        }
    }
};

Pluto.decodeCategories = function(data, extra) {
    try {
        var Name;
	var Link;
	var ImgLink;

        for (var i in Pluto.categories) {
            if (Pluto.categories[i].name.match(/^(Nytt|Popu)/)) continue;
            categoryToHtml(Pluto.categories[i].name,
                           Pluto.fixThumb(Pluto.categories[i].thumb),
                           Pluto.fixThumb(Pluto.categories[i].thumb, DETAILS_THUMB_FACTOR),
                           Pluto.makeCategoryLink(Pluto.categories[i].ids.slice(-1), 1000)
                          );
        }
	data = null;
    } catch(err) {
        Log('Pluto.decodeCategories Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Pluto.decodeCategoryDetail = function(data, extra) {

    var Name = getUrlParam(getLocation(extra.refresh), 'catName');
    var DetailIndex = Pluto.getCategoryDetailIndex();

    extra.sort = true;

    // Check if Pluto.category_details are up to data
    if (DetailIndex.current != 0) {
        var Current = Pluto.category_details[DetailIndex.current];
        if (!Current || Name != Current.main_name) {
            // Wrong Category - must re-initiate Tabs data.
            alert('WRONG CATEGORY_DETAILS');
            extra.no_html = true;
            Pluto.setuUpCategoryDetail(Name, extra, function() {
                extra.no_html = false;
                extra.url = Pluto.category_details[DetailIndex.current].url;
                requestUrl(extra.url,
                           function(status,data) {
                               Pluto.decodeCategoryDetail(data, extra);
                           },
                           {headers: Pluto.getHeaders()}
                          );
            });
            return;
        }
    }

    if (DetailIndex.current == 0 && Channel.main_id() != 'history') {
        if (!Pluto.setuUpCategoryDetail(Name, extra))
            Pluto.decode(data, extra);
    } else {
        Pluto.decode(data, extra);
    }
};

Pluto.setuUpCategoryDetail = function(name, extra, cb) {
    for (var i in Pluto.categories) {
        if (Pluto.categories[i].name == name) {
            extra.result =
                Pluto.getCategories(Pluto.categories[i].ids,
                                    extra,
                                    1000,
                                    function(extra, result) {
                                        Pluto.initCategoryDetailsTabs(name, extra, result);
                                        extra.result = null;
                                        cb && cb();
                                    });
            return true;
        }
    }

};

Pluto.initCategoryDetailsTabs = function (main_name, extra, result) {
    var title, name, id, main_id = extra.url.match(/categories\/([^/]+)/)[1];
    Pluto.category_details = [];
    Pluto.category_detail_max_index = 0;
    // Add main view
    Pluto.category_details.push({name: main_name,
                                 title: main_name,
                                 main_name: main_name,
                                 id  : main_id,
                                 url : extra.url
                                });
    for (var i in Pluto.categories) {
        if (Pluto.categories[i].name == main_name) {
            for (var j in Pluto.categories[i].ids) {
                id = Pluto.categories[i].ids[j];
                if (Pluto.isMainCategory(id, result, extra.result.total_items))
                    continue;
                name = Pluto.getCategoryName(id);
                title = name.replace(new RegExp('^' + main_name + ' *: *'),'');
                Pluto.category_details.push({name: name,
                                             title: title,
                                             main_name: main_name,
                                             id:  id,
                                             url: Pluto.makeCategoryLink(id, 1000)
                                            });
            }
        }
    }

    Pluto.category_detail_max_index = Pluto.category_details.length-1;
    Language.fixBButton();
};

Pluto.decodeLive = function(data, extra) {
    Language.fixCButton();

    if (Pluto.getLiveSectionIndex().current == 1) {
        data = null;
        return Pluto.decodeLiveCategories(extra);
    }

    data = JSON.parse(data.responseText).data;
    data.sort(function(a,b) {
        return (extra.url.indexOf(a.channelId) <
                extra.url.indexOf(b.channelId)) ? -1 : 1;
    });

    try {
        var Name;
        var Duration;
        var Link;
        var ImgLink;
        var Background;
        var start;
        var end;

        for (var k in data) {
            ImgLink = Pluto.getChannel(data[k].channelId).thumb;
            Link = Pluto.makeLiveLink([data[k].channelId]);
            data[k] = Pluto.getCurrentTimeline(data[k]);
            Background = ImgLink;
            if (data[k].episode && data[k].episode.series.type == 'film')
                Background = data[k].episode.poster.path;
            Background = Pluto.fixThumb(Background, BACKGROUND_THUMB_FACTOR);
            start = timeToDate(data[k].start);
            end = timeToDate(data[k].stop);
            Duration = Math.round((end-start)/1000);
            Name = data[k].episode.name;
            Name = dateToClock(start) + '-' + dateToClock(end) + ' ' + Name;
            toHtml({name:Name,
                    start:start,
                    duration:Duration,
                    is_channel:true,
                    link:Link,
                    link_prefix:'<a href="details.html?ilink=',
                    thumb:ImgLink,
                    background:Background
                   });
            data[k] = '';
	}
        data = null;
    } catch(err) {
        Log('Pluto.decodeChannels Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Pluto.decodeLiveCategories = function(extra) {
    for (var k in Pluto.live_categories) {
        toHtml({name: Pluto.live_categories[k].name,
                thumb: Pluto.fixThumb(Pluto.live_categories[k].thumb),
                // A bit ugly to hard code tab_index;
                link_prefix: '<a href="live.html?tab_index=2&url=',
                link : encodeURIComponent(Pluto.makeLiveLink(Pluto.live_categories[k].ids))
               });
    }

    if (extra.cbComplete)
        extra.cbComplete();
};

Pluto.useLiveRefresh = function() {
    return Pluto.getLiveSectionIndex().current != 1;
};


Pluto.getCurrentTimeline = function(data) {
    for (var k in data.timelines) {
        start = timeToDate(data.timelines[k].start);
        end   = timeToDate(data.timelines[k].stop);
        if (getCurrentDate() > start && end > getCurrentDate()) {
            return data.timelines[k];
        }
    }
};

Pluto.decodeShowList = function(data, extra) {
    Pluto.decodeShow(data, extra);
};

Pluto.decodeSearchList = function(data, extra) {
    var ids = [];
    var query=null;
    var channels = [];

    if (extra.query.length == 1)
        query = new RegExp('^' + extra.query, 'i');

    data = JSON.parse(data.responseText).data;
    for (var k in data) {
        if (data[k].type == 'channel')
            channels.push(data[k].id);
        if (!data[k].type.match(/(series|movie)/)) continue;
        if (query && !query.test(data[k].name)) continue;
        ids.push(data[k].id);
    }
    for (var i in channels) {
        var channel = Pluto.getChannel(channels[i]);
        toHtml({name: channel.name,
                thumb: channel.thumb,
                background: Pluto.fixThumb(channel.thumb, BACKGROUND_THUMB_FACTOR),
                link_prefix: '<a href="details.html?ilink=',
                link: Pluto.makeLiveLink([channels[i]]),
                is_channel: true
               });
    }
    if (ids.length > 0) {
        extra.url = addUrlParam(PLUTO_VOD_API+'items', 'ids', ids.join(','));
        requestUrl(extra.url,
                   function(status, data) {
                       Pluto.decode(data, extra);
                   },
                   {headers:Pluto.getHeaders()}
                  );
    } else
        extra.cbComplete && extra.cbComplete();
};

Pluto.getNextCategoryDetail = function() {
    var nextLocation    = getNextIndexLocation(Pluto.category_detail_max_index);
    var category_detail = Pluto.getCategoryDetailIndex();
    if (category_detail.next == 0)
        return 'categories.html';
    var main_name = Pluto.category_details[category_detail.current].main_name;
    var new_title = Pluto.category_details[category_detail.next].title;
    if (category_detail.current != 0) {
        nextLocation = nextLocation.replace(/\/[^/]+\/$/,'/');
    }
    return nextLocation + new_title + '/';
};

Pluto.getCategoryDetailIndex = function () {
    return getIndex(Pluto.category_detail_max_index);
};

Pluto.getNextCategoryDetailText = function() {
    var next = Pluto.getCategoryDetailIndex().next;
    if (Pluto.category_details.length > next) {
        var text = Pluto.category_details[next].name;
        var category = decodeURIComponent(getIndexLocation().match(/catName=([^&]+)/)[1]);
        if (Pluto.category_details[next].main_name == category) {
            if(next == 0)
                // We're at the end - start over with default
                return null;
            else
                return text;
        }
    } else if (Pluto.category_details.length == 0)
        return null;
    // Wrong category - keep unchanged
    return 0;
};

Pluto.getNextLiveSection = function() {
    var live_section = Pluto.getLiveSectionIndex();
    if (live_section.current > 0)
        return 'live.html';
    else
        return getNextIndexLocation(2);
};

Pluto.getLiveSectionIndex = function () {
    return getIndex(2);
};

Pluto.getHeaderPrefix = function() {
    return 'Pluto';
};

Pluto.getLiveTitle = function(location) {
    if (Pluto.getLiveSectionIndex().current == 0)
        return 'Livesändningar';
    else if (Pluto.getLiveSectionIndex().current == 1)
        return 'Livekategorier';
    else
        return getUrlParam(location, 'history');
};

Pluto.keyRed = function() {
    if ($('#a-button').text().match(/^Pop/)) {
	setLocation('index.html');
    } else {
	setLocation('Latest.html');
    }
};

Pluto.keyGreen = function() {
    var loc = getIndexLocation();
    if (loc.match(/categoryDetail\.html/))
	setLocation(Pluto.getNextCategoryDetail());
    else
        setLocation('categories.html');
};

Pluto.keyYellow = function() {
    var loc = getIndexLocation();
    if (loc.match('live.html'))
        setLocation(Pluto.getNextLiveSection());
    else
        setLocation('live.html');
};

Pluto.getAButtonText = function(language) {
    var loc = getIndexLocation();
    if (loc.match(/index\.html/)) {
        if(language == 'English'){
	    return 'Latest';
        } else {
	    return 'Senaste';
        }
    } else {
        if(language == 'English'){
	    return 'Popular';
        } else {
	    return Pluto.getMainTitle();
        }
    }
};

Pluto.getBButtonText = function(language) {
    var loc = getIndexLocation();
    if (loc.match(/categoryDetail\.html/))
        return Pluto.getNextCategoryDetailText(language);
    return null;
};

Pluto.getCButtonText = function(language) {
    var is_live = getIndexLocation().match('live.html');
    if (is_live && Pluto.getLiveSectionIndex().next == 1) {
        if(language == 'English')
	    return 'Live categories';
        else
            return 'Livekategorier';
    } else {
        if(language == 'English')
	    return 'Live broadcasts';
        else
            return 'Livesändningar';
    }
};


Pluto.decodeShow = function(data, extra) {
    try {
        var ImgLink;
        var seasons = [];
        data = JSON.parse(data.responseText);
        if (!extra.season && extra.season !== 0) {
            ImgLink = Pluto.fixThumb(data);
            for (var i in data.seasons) {
                seasons.push({season: data.seasons[i].number,
                              name: 'Säsong ' + data.seasons[i].number,
                              episodes: data.seasons[i].episodes
                             });
            }
            data = null;
            seasons.sort(function(a, b){
                return b.season-a.season;
            });
            if (seasons.length > 1) {
                for (var j in seasons)
                    seasonToHtml(seasons[j].name,
                                 ImgLink,
                                 extra.url,
                                 seasons[j].season
                                );
            } else if (seasons.length == 1) {
                return callTheOnlySeason(seasons[0].name, extra.url, extra.loc);
            }
        } else {
            for (var n in data.seasons) {
                if (extra.season === 0 ||
                    extra.season == data.seasons[n].number) {
                    data = data.seasons[n].episodes;
                    break;
                }
            }
            Pluto.decodeSeason(data, extra);
            data = null;
        }
    } catch(err) {
        if (data)
            Log('Pluto.decodeSeason Exception:' + err.message + ' data:' + JSON.stringify(data));
        else
            Log('Pluto.decodeSeason Exception:' + err.message);
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Pluto.decodeSeason = function(data, extra) {
    try {
        var Name;
        var Duration;
        var Link;
        var Description;
        var ImgLink;
        var Background;
        var next = null;
        var AirDate;
        var Episode=null;
        var Season=null;
        var Show=null;
        var ShowId=null;
        var IsLive=null;
        var UserData=null;

        data.sort(function(a, b){
            return b.number-a.number;
        });
        for (var k in data) {
            ImgLink = Pluto.fixThumb(data[k]);
            Background = Pluto.fixThumb(data[k], BACKGROUND_THUMB_FACTOR);
            Duration = data[k].originalContentDuration/1000;
            Description = data[k].name;
            if (Description.match(/^Avsnitt/)) {
                Description = data[k].description;
            }
            Episode = data[k].number;
            Season  = data[k].season;
            if (Episode > (Season*100))
                Episode = Episode - (Season*100);
            Name = 'Avsnitt ' + Episode;
            UserData = JSON.stringify({ep_id:data[k]._id, season:Season}),
            Link = addUrlParam(extra.url, 'my_user_data', UserData);
            // https://service-vod.clusters.pluto.tv/v4/vod/episodes/621738a3a5b2950013c2d478
            toHtml({name:Name,
                    duration:Duration,
                    link:Link,
                    link_prefix:'<a href="details.html?ilink=',
                    description:Description,
                    thumb:ImgLink,
                    background:Background,
                    season:Season,
                    episode:Episode
                   });
	}
        data = null;
    } catch(err) {
        if (data)
            Log('Pluto.decodeSeason Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
        else
            Log('Pluto.decodeSeason Exception:' + err.message);
    }
};

Pluto.decode = function(data, extra) {
    var Name;
    var Link;
    var ImgLink;
    var next = null;
    var isSeason=false;
    var LinkPrefix = null;
    var query = null;
    var json = null;
    var NonShow=false;
    var Description;
    var Background;
    var Links = extra.result && extra.result.links || [];
    var Result = extra.result && extra.result.items || [];
    var TotalItems = 0;

    data = JSON.parse(data.responseText);
    if (data.items)
        data = data.items;

    for (var k in data) {
        LinkPrefix = Description = Background = null;
        Name = data[k].name;
        ImgLink = Pluto.fixThumb(data[k]);
        if (data[k].type == 'series') {
            Link = PLUTO_VOD_API + 'series/' + data[k]._id + '/seasons?offset=1000&page=1';
            if (Links.indexOf(Link) != -1) {
                // alert(Name + ' found in links');
                continue;
            }
            Result.push({name:Name, thumb:ImgLink, link:Link, is_show:true});
        } else {
            Link = PLUTO_VOD_API + 'slugs?slugs=' + data[k].slug;
            if (Links.indexOf(Link) != -1) {
                // alert(Name + ' found in links');
                continue;
            }
            Result.push({name:Name,
                         duration: data[k].originalContentDuration/1000,
                         link:Link,
                         link_prefix: '<a href="details.html?ilink=',
                         description: data[k].summary,
                         thumb:Pluto.fixThumb(data[k], null, true),
                         background:Pluto.fixThumb(data[k], BACKGROUND_THUMB_FACTOR)
                        });
        }
        Links.push(Link);
    }

    TotalItems = Result.length;

    if (!extra.has_more && !extra.no_html) {
        if (extra.sort) Pluto.sortByName(Result);

        for (var j in Result) {
            if (Result[j].is_show)
                showToHtml(Result[j].name, Result[j].thumb, Result[j].link);
            else
                toHtml(Result[j]);
        }
        Result = [];

        if (extra.cbComplete)
            extra.cbComplete();
    }

    return {links:Links, items:Result, total_items:TotalItems};
};

Pluto.getDetailsData = function(url, data, user_data) {
    if (url.match(/channelIds=/))
        return Pluto.getLiveData(url, data);
    if (!user_data && !url.match(/slugs=/))
        return Pluto.getShowData(url,data);

    var Name='';
    var Title = Name;
    var DetailsImgLink='';
    var AirDate='';
    var VideoLength = '';
    var AvailDate=null;
    var Description='';
    var Show=null;
    var Season=null;
    var Episode=null;
    var IsLive=false;
    try {
        Show = JSON.parse(data.responseText);
        data = Pluto.findEpisode(Show, user_data);
	DetailsImgLink = Pluto.fixThumb(data, DETAILS_THUMB_FACTOR, true);
        VideoLength = dataLengthToVideoLength(null, data.originalContentDuration/1000);
	Description = data.description;
        Episode = data.number;
        Season  = data.season;
        if (Episode > (Season*100))
            Episode = Episode - (Season*100);
        Name = data.name;
        if (Name.match(/^Avsnitt/))
            Name = 'Avsnitt ' + Episode;
        Title = Name;
        if (Show.type == 'series') {
            data = Show;
            Show = {name  : data.name,
                    url   : url,
                    thumb : Pluto.fixThumb(data)
                   };
        } else {
            Show = {name  : data.genre,
                    url   : Pluto.makeCategoryLink(data.categoryID, 1000),
                    thumb : Pluto.fixThumb(data, null, true),
                    large_thumb : Pluto.fixThumb(data, DETAILS_THUMB_FACTOR, true),
                    is_category : true
                   };
        }
        // if (data.one_off && data.format_categories && data.format_categories.length) {
        //     Show.name = data.format_categories[0].name.trim();
        //     Show.large_thumb = Pluto.fixThumb(Show.thumb, DETAILS_THUMB_FACTOR);
        //     Show.url = 'http://playapi.mtgx.tv/v3/formats?category=' + data.format_categories[0].id + '&fromIndex=1&limit=500';
        //     Show.is_category = true;
        // } else
    } catch(err) {
        Log('Pluto.getDetailsData Exception:' + err.message);
        Log('Name:' + Name);
        Log('AirDate:' + AirDate);
        Log('AvailDate:' + AvailDate);
        Log('VideoLength:' + VideoLength);
        Log('Description:' + Description);
        Log('DetailsImgLink:' + DetailsImgLink);
    }
    data = null;
    return {name          : Name,
            title         : Title,
            is_live       : IsLive,
            air_date      : AirDate,
            avail_date    : AvailDate,
            start         : AirDate,
            duration      : VideoLength,
            description   : Description,
            not_available : false,
            thumb         : DetailsImgLink,
            season        : Season,
            episode       : Episode,
            episode_name  : Name,
            parent_show   : Show
    };
};

Pluto.getShowData = function(url, data) {

    var Name='';
    var DetailsImgLink='';
    var Description='';
    var Genre = [];

    try {
        data = JSON.parse(data.responseText);
        Name = data.name;
        Description = data.description;
        DetailsImgLink = Pluto.fixThumb(data, DETAILS_THUMB_FACTOR);
        Genre.push(data.genre);
    } catch(err) {
        Log('Pluto.getShowData exception:' + err.message);
        Log('Name:' + Name);
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

Pluto.getLiveData = function(url, data) {
    var channelId='';
    var Name='';
    var Title = Name;
    var ImgLink='';
    var AirDate='';
    var VideoLength = '';
    var Description='';
    var start=0;
    var end=0;
    var isLive = false;
    var Episode=null, Season=null;
    try {
        channelId = getUrlParam(url, 'channelIds');
        data = JSON.parse(data.responseText).data[0];
        data = Pluto.getCurrentTimeline(data);
        Name = Pluto.getChannel(channelId).name + ' - ' + data.episode.name;
        ImgLink = Pluto.getChannel(channelId).thumb;
        if (data.episode.series && data.episode.series.type == 'film')
            ImgLink = data.episode.poster.path;
        else {
            Episode = data.episode.number;
            Season  = data.episode.season;
            if (Episode > Season*100)
                Episode -= Season*100;
            Description = data.episode.series.name + ' Säsong ' + Season;
            Description += ' Avsnitt ' + Episode + '<br>';
        }
        Description += data.episode.description;
        ImgLink = Pluto.fixThumb(ImgLink, DETAILS_THUMB_FACTOR);
        start = timeToDate(data.start);
        end = timeToDate(data.stop);
        VideoLength = Math.round((end-start)/1000);
        VideoLength = dataLengthToVideoLength(null,VideoLength);
        AirDate = dateToClock(start) + '-' + dateToClock(end);
        Title = AirDate + ' ' + Name;
        isLive = true;
    } catch(err) {
        Log('Pluto.getDetails Exception:' + err.message);
        Log('Name:' + Name);
        Log('AirDate:' + AirDate);
        Log('VideoLength:' + VideoLength);
        Log('Description:' + Description);
        Log('ImgLink:' + ImgLink);
    }
    data = null;
    return {name        : Name.trim(),
            title       : Title.trim(),
            is_live     : isLive,
            air_date    : AirDate,
            start       : start,
            duration    : VideoLength,
            description : Description,
            thumb       : ImgLink,
            episode     : Episode,
            season      : Season
           };
};

Pluto.findEpisode = function(data, user_data) {
    user_data = user_data && JSON.parse(user_data);
    var Episode = user_data && user_data.ep_id;
    var Season  = user_data && user_data.season;

    for (var i in data.seasons) {
        if (data.seasons[i].number == Season || !Season) {
            for (var j in data.seasons[i].episodes) {
                if (data.seasons[i].episodes[j]._id == Episode) {
                    return data.seasons[i].episodes[j];
                }
            }
        }
    }
    return (data.length == 1) ? data[0] : data;
};

Pluto.getCategoryName = function(id) {
    for (var i in Pluto.sub_categories)
        if (Pluto.sub_categories[i].id == id)
            return Pluto.sub_categories[i].name;
};

Pluto.getChannel = function(id) {
    for (var i in Pluto.channels)
        if (Pluto.channels[i].id == id)
            return Pluto.channels[i];
};

Pluto.getDetailsUrl = function(streamUrl) {
    return Pluto.refreshLiveLink(streamUrl);
};

Pluto.getPlayUrl = function(url, isLive) {
    var user_data = getUrlParam(url, 'my_user_data');
    var channel_id = getUrlParam(url, 'channelIds');
    var extra = {isLive:isLive, useBitrates:true};
    if (channel_id) {
        url = 'https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/';
        url = Pluto.addPlayUrlParams(url + channel_id + '/master.m3u8');
        extra.use_offset = true;
        extra.use_vjs = (deviceYear > 2017);
        return Pluto.playUrl(url, extra);
    }

    requestUrl(removeUrlParam(url, 'my_user_data'),
               function(status, data) {
                   if (Player.checkPlayUrlStillValid(url)) {
                       data = JSON.parse(data.responseText);
                       data = Pluto.findEpisode(data, user_data);
                       data = data.stitched.path;
                       data = 'https://service-stitcher-ipv4.clusters.pluto.tv/v2' + data;
                       data = Pluto.addPlayUrlParams(data);
                       Pluto.playUrl(data, extra);
                   }
               },
               {headers:Pluto.getHeaders()}
              );
};

Pluto.playUrl = function(url, extra) {
    if (!extra.isLive)
        url = Pluto.skipAds(url);
    Resolution.getCorrectStream(url, null, extra);
};

Pluto.skipAds = function(url) {
    if (Pluto.is_proxy_alive) {
        url = addUrlParam(url, 'myskipads', 1);
        url = Redirect(url);
    }
    return url;
};

Pluto.fixThumb = function(thumb, factor, use_poster) {
    if (!thumb)
        return thumb;
    var target = (use_poster && thumb.type == 'movie') ? '347:500' : '16:9';
    if (thumb.featuredImage && thumb.type != 'movie') {
        thumb = thumb.featuredImage.path;
    } else if (thumb.covers) {
        for (var i in thumb.covers) {
            if (thumb.covers[i].aspectRatio == target) {
                thumb = thumb.covers[i].url;
                break;
            }
        }
    } else if (thumb.images) {
        for (var j in thumb.images) {
            if (thumb.images[j].type == 'featuredImage') {
                thumb = thumb.images[j].url;
                break;
            }
        }
    }
    thumb = thumb.replace(/&[hw]=[^&]+/g,'');
    if (!factor) factor = 1;
    thumb = addUrlParam(thumb, 'h', Math.round(factor*THUMB_HEIGHT));
    thumb = addUrlParam(thumb, 'w', Math.round(factor*THUMB_WIDTH));
    return thumb;
};

Pluto.isMainCategory = function(id, result, total_items) {
    for (var i in result) {
        if (result[i].id == id) {
            return result[i].items == total_items;
        }
    }
};

Pluto.sortByName = function(array) {
    array.sort(function(a, b) {
        if (b.name.toLowerCase() > a.name.toLowerCase())
            return -1;
        return 1;
    });
};
