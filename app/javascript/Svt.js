// https://www.svtstatic.se/image/small/224/24061018/1571995297

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=ContinueWatchingQuery&variables={"history":[{"id":"1388669-006A","progressSeconds":1217}]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"b571e9100b8601b48a695e9ebec26aa39261564feb1d9af1bbbdfa0b31fb5b4b"}}

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=PersonalRecommendations&variables={"history":["4848918"]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"5c68e176630c5178e75cee30d7b6f34c023adc79b9026f6f545216ffa45507f3"}}

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=TitlePageSimilarContent&variables={"titleSlugs":["al-pitcher-pa-paus"],"abTestVariants":[]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"89b185f33d69105e933e788f9ad12c5f976523c90e6cf67f4ef342e86d84a04e"}}

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=VideoPageSimilarContent&variables={"escenicIds":[21744946],"abTestVariants":[]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"b4cb0372ea38ff877bbadde706980d63b09aef8b8448ec3a249cd4810e5f15bd"}}

var SVT_API_BASE = 'https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=';
var SVT_ALT_API_URL = 'https://api.svt.se/videoplayer-api/video/';

var Svt = {
    sections:[],
    section_max_index:0,
    category_details:[],
    category_detail_max_index:0,
    thumbs_index:null,
    play_args:{}
};

Svt.getHeaderPrefix = function() {
    return 'SVT';
};

Svt.getSectionTitle = function(location) {
    return Svt.sections[Svt.getSectionIndex().current].name;
};

Svt.getCategoryTitle = function() {
    switch (Svt.getCategoryIndex().current) {
    case 0:
        return 'Kategorier';
    case 1:
        return 'Utvalt';
    case 2:
        return 'Alla Kategorier';
    case 3:
        return 'Alla Program';
    }
};

Svt.keyRed = function() {
    Svt.setNextSection();
};

Svt.keyGreen = function() {
    if (getIndexLocation().match(/categoryDetail\.html/))
	setLocation(Svt.getNextCategoryDetail());
    else if (getIndexLocation().match(/categories\.html/))
        setLocation(Svt.getNextCategory());
    else
        setLocation('categories.html');
};

Svt.getAButtonText = function(language) {
    return Svt.getNextSectionText();
};

Svt.getBButtonText = function(language, catLoaded) {
    var loc = getIndexLocation();
    var text = null;
    if (loc.match(/categoryDetail\.html/) && !getUrlParam(loc,'collection_id'))
        text = Svt.getNextCategoryDetailText(language);
    else if (loc.match(/categories\.html/))
        text = Svt.getNextCategoryText();
    return text;
};

Svt.makeApiLink = function(Operation, variables, sha) {
    var Link = addUrlParam(SVT_API_BASE + Operation,
                           'variables',
                           variables
                          );
    return addUrlParam(Link,
                       'extensions',
                       '{"persistedQuery":{"version":1,"sha256Hash":"' + sha + '"}}'
                      );
};

Svt.makeGenreLink = function (data) {
    return Svt.makeApiLink('GenreProgramsAO',
                           '{"genre":["' + data.id + '"]}',
                           '189b3613ec93e869feace9a379cca47d8b68b97b3f53c04163769dcffa509318'
                          );
};

Svt.makeShowLink = function (data) {
    var Link = data.slug;
    if (!Link && data.contentUrl)
        Link = data.contentUrl.match(/video\/[0-9]+\/([^\/]+)/)[1];
    else if (!Link && data.urls)
        Link = data.urls.svtplay.replace(/^\//, '');

    return Svt.makeApiLink('TitlePage',
                           '{"titleSlugs":["' + Link + '"]}',
                           '4122efcb63970216e0cfb8abb25b74d1ba2bb7e780f438bbee19d92230d491c5'
                          );
};

Svt.makeSearchLink = function (query) {
    return Svt.makeApiLink('SearchPage',
                           '{"querystring":["' + query + '"]}',
                           'bed799b6f3105046779adff02a29028c1847782da4b171e9fe1bcc48622a342d'
                          );
};

Svt.makeEpisodeLink = function (data) {
    var ArticleId = data.articleId;
    if (!ArticleId) {
        ArticleId = data.urls.svtplay.match(/\/(video|klipp)\/([0-9]+)/);
        ArticleId = ArticleId && ArticleId[2];
    }

    return Svt.makeApiLink('VideoPage',
                           '{"legacyIds":[' + ArticleId + ']}',
                           'ae75c500d4f6f8743f6673f8ade2f8af89fb019d4b23f464ad84658734838c78'
                          );
};

Svt.checkThumbIndex = function(index, data) {
    if (data && Svt.getThumbIndex(+index)!=data) {
        Svt.thumbs_index[+index] = data;
        Config.save('svtThumbs', Svt.thumbs_index);
    }
};

Svt.getThumbIndex = function(index) {
    if (Svt.thumbs_index == null) {
        Svt.thumbs_index = Config.read('svtThumbs');
        if (Svt.thumbs_index == null)
            Svt.thumbs_index = [];
    }
    return Svt.thumbs_index[+index];
};

Svt.getThumb = function(data, size) {

    if (data.images) {
        for (var key in data.images) {
            if (key.match(/wide$/)) {
                data.image = data.images[key];
                break;
            }
        }
    } else if (data.item) {
        return Svt.getThumb(data.item, size);
    }

    data = data.image;

    if (!data) return null;
    if (size == 'extralarge')
        size = 'wide/' + Math.round(BACKGROUND_THUMB_FACTOR*THUMB_WIDTH);
    else if (size == 'large')
        size = 'wide/' + Math.round(DETAILS_THUMB_FACTOR*THUMB_WIDTH);
    else {
        // size = 'small/' + THUMB_WIDTH;
        // Seems 224 is standard and faster...
        size = 'small/' + 224;
    }
    return 'https://www.svtstatic.se/image/' + size + '/' + data.id + '/' + data.changed;
};

Svt.isPlayable = function (url) {
    return url.match(/VideoPage/);
};

Svt.getSectionIndex = function() {
    return getIndex(Svt.section_max_index);
};

Svt.getNextSectionIndex = function() {
    if (!getIndexLocation().match(/(section|index)\.html/)) {
        return 0;
    }else
        return Svt.getSectionIndex().next;
};

Svt.getNextSectionText = function() {
    if (Svt.sections.length == 0)
        // Sections not added yet
        return 'Populärt';

    return Svt.sections[Svt.getNextSectionIndex()].name;
};

Svt.setNextSection = function() {
    if (Svt.getNextSectionIndex() == 0) {
        setLocation('index.html');
    } else {
        var nextLoc = getNextIndexLocation(Svt.section_max_index);
        setLocation(nextLoc.replace('index.html', 'section.html'));
    }
};

Svt.getDetailsUrl = function(streamUrl) {
    return streamUrl;
};

Svt.getDetailsData = function(url, data) {

    if (url.match('oppet-arkiv-api'))
        return Oa.getDetailsData(url, data);

    if (!Svt.isPlayable(url) && !url.match(/=ChannelsQuery/)) {
        return Svt.getShowData(url, data);
    }

    var Name='';
    var Title = Name;
    var ImgLink='';
    var ImgLinkAlt='';
    var AirDate='';
    var VideoLength = '';
    var AvailDate=null;
    var Description='';
    var NotAvailable=false;
    var startTime=0;
    var endTime=0;
    var Show = null;
    var isLive = false;
    var Season=null;
    var Episode=null;
    var EpisodeName=null;
    var Variant=null;
    try {
        if (url.match(/=ChannelsQuery/)) {
            data = JSON.parse(data.responseText).data.channels.channels;
            for (var i in data) {
                if (data[i].id == getUrlParam(url, 'chId')) {
                    data = data[i];
                    break;
                }
            }
            Name = data.name.trim() + ' - ' + data.running.name.trim();
            if (data.running.description)
	        Description = data.running.description.trim();
            ImgLink = Svt.getThumb(data.running, 'large');
            if (!ImgLink)
	        ImgLink = Svt.GetChannelThumb(data.name);
            startTime = timeToDate(data.running.start);
            endTime = timeToDate(data.running.end);
            VideoLength = Math.round((endTime-startTime)/1000);
            AirDate = dateToClock(startTime) + '-' + dateToClock(endTime);
            Title = AirDate + ' ' + Name;
            isLive = true;
            NotAvailable = (startTime - getCurrentDate()) > 60*1000;
        } else {
            data = JSON.parse(data.responseText).data.listablesByEscenicId[0];
            ImgLink = Svt.getThumb(data, 'large');
            if (data.parent && data.parent.__typename != 'Single') {
                Show = {name : data.parent.name,
                        url  : Svt.makeShowLink(data.parent),
                        thumb: Svt.getThumb(data.parent)
                       };
            } else if (data.genres && data.genres.length > 0) {
                Show = data.genres[0];
                for (var genre in data.genres) {
                    if (data.genres[genre].type == 'Main')
                        continue;
                    Show = data.genres[genre];
                    break;
                }
                Show = {name        : Show.name,
                        url         : Svt.makeGenreLink(Show),
                        thumb       : Svt.getThumb(data, 'small'),
                        large_thumb : ImgLink,
                        is_category : true
                       };
            }
            Season = Svt.getSeasonNumber(data);
            Episode = Svt.getEpisodeNumber(data);
            EpisodeName = data.name;
            Variant = data.accessibilities;
            if (Variant && Variant[0] != 'Default')
                Variant = Variant[0];
            else
                Variant = null;
            Name = data.name;
            if (Show && Show.name != Name)
                Name = Show.name + ' - ' + Name;
            if (data.longDescription)
                Description = data.longDescription;
            Title = Name;
            AirDate = Svt.getAirDate(data);
            VideoLength = data.duration;
            startTime = AirDate;
            if (data.validTo)
                endTime = timeToDate(data.validTo);
            if (!VideoLength && startTime && endTime) {
                VideoLength = Math.round((endTime-startTime)/1000);
            }
            isLive = data.live && (endTime > getCurrentDate());
            if (isLive) {
                NotAvailable = (getCurrentDate() < startTime);
            } else if (data.validTo) {
		AvailDate = timeToDate(data.validTo);
                var hoursLeft = Math.floor((AvailDate-getCurrentDate())/1000/3600);
                AvailDate = dateToHuman(AvailDate);
                if (hoursLeft > 24)
                    AvailDate = AvailDate + ' (' + Math.floor(hoursLeft/24) + ' dagar kvar)';
                else
                    AvailDate = AvailDate + ' (' + hoursLeft + ' timmar kvar)';
            }
        }
        VideoLength = dataLengthToVideoLength(null,VideoLength);
    } catch(err) {
        Log('Svt.getDetails Exception:' + err.message);
        Log('Name:' + Name);
        Log('AirDate:' + AirDate);
        Log('AvailDate:' + AvailDate);
        Log('VideoLength:' + VideoLength);
        Log('Description:' + Description);
        Log('NotAvailable:' + NotAvailable);
        Log('ImgLink:' + ImgLink);
    }
    data = null;
    return {name          : Name.trim(),
            title         : Title.trim(),
            is_live       : isLive,
            air_date      : AirDate,
            avail_date    : AvailDate,
            start_time    : startTime,
            duration      : VideoLength,
            description   : Description,
            not_available : NotAvailable,
            thumb         : ImgLink,
            season        : Season,
            variant       : Variant,
            episode       : Episode,
            episode_name  : EpisodeName,
            parent_show   : Show
    };
};

Svt.getShowData = function(url, data) {

    var Name='';
    var Genre = Name;
    var ImgLink='';
    var Description='';

    try {
        data = JSON.parse(data.responseText).data;
        if (data.listablesByEscenicId)
            data = data.listablesByEscenicId[0];
        else
            data = data.listablesBySlug[0];

        if (url.match(/title_clips_by_title_article_id/)) {
            data = data[0];
            Name = 'Klipp';
        } else
            Name = data.name.trim();

        ImgLink = Svt.getThumb(data, 'large');
	Description = data.shortDescription;
        if (Description && data.longDescription.indexOf(Description) == -1)
            Description = '<p>' + Description + '</p>' + data.longDescription;
        else
            Description = data.longDescription;
        Genre = [];
        for (var i=0; i < data.genres.length; i++) {
            Genre.push(data.genres[i].name);
        }
        Genre.sort();
        Genre = Genre.join('/');
        if (!Genre)
            Genre = '';

    } catch(err) {
        Log('Details Exception:' + err.message);
        Log('Name:' + Name);
        Log('Genre:' + Genre);
        Log('Description:' + Description);
        Log('ImgLink:' + ImgLink);
    }
    data = null;
    return {show          : true,
            name          : Name,
            description   : Description,
            genre         : Genre,
            thumb         : ImgLink
           };
};

Svt.getUrl = function(tag, extra) {
    switch (tag.replace(/\.html.+/,'.html')) {
    case 'main':
        return Svt.makeApiLink('StartPage',
                               '{}',
                               'ed75c27d9ea5c3319ed4fb88f483e3abbf156361cffccd2c1ec271dc70ce08d9'
                              );

    case 'section':
        return Svt.getSectionUrl(extra.location);

    case 'categories':
        return Svt.getCategoryUrl();

    case 'categoryDetail':
        return Svt.getCategoryDetailsUrl(extra.location);

    case 'live':
        return Svt.makeApiLink('ChannelsQuery',
                               '{}',
                               '65ceeccf67cc8334bc14eb495eb921cffebf34300562900076958856e1a58d37'
                              );

    case 'searchList':
        return Svt.makeSearchLink(extra.query);

    default:
        alert('Default:' + tag);
        return tag;
    }
};

Svt.getSectionUrl = function(location) {
    if (location.match(/similar.html\?url=/)) {
        PathHistory.GetPath();
        return location.match(/similar.html\?url=([^&]+)/)[1];
    }

    var index = location.match(/tab_index=([0-9]+)/)[1];
    return Svt.sections[index].url;
};

Svt.getCategoryUrl = function() {
    switch (Svt.getCategoryIndex().current) {
    case 0:
        return Svt.makeApiLink('MainGenres',
                               '{}',
                               '66fea23f05ac32bbb67e32dbd7b9ab932692b644b90fdbb651bc039f43e387ff'
                              );
    case 1:
        return  Svt.makeApiLink('FionaExperiment',
                                '{"abTestVariants":[{"project":"svtplay","experiment":"contento-fiona-start","variant":"with-lists"}]}',
                                '5b16903ef70149f5537bcaf2f6d622e74325b7bad7fa1e8b6b6ec837c994f1b7'
                               );

    case 2:
        return Svt.makeApiLink('AllGenres',
                               '{}',
                               '6bef51146d05b427fba78f326453127f7601188e46038c9a5c7b9c2649d4719c'
                              );
    case 3:
        return Svt.makeApiLink('ProgramsListing',
                               '{}',
                               '1eeb0fb08078393c17658c1a22e7eea3fbaa34bd2667cec91bbc4db8d778580f'
                              );
    }
};

Svt.getCategoryDetailsUrl = function(location) {
    var DetailIndex = Svt.getCategoryDetailIndex();
    switch (DetailIndex.current) {
    case 0:
        return location;

    default:
        if (DetailIndex.current > Svt.category_detail_max_index)
            return Svt.category_details[0].url; // Lets sort it when response is received.
        return Svt.category_details[DetailIndex.current].url;
    }
};

Svt.upgradeUrl = function(url) {

    if (url.match(/\/genre\//))
        return Svt.makeGenreLink({id:url.replace(/.*\/genre\//,'')});
    else if (url.match(/cluster_titles_and_episodes\?cluster=([^?&]+)/))
        return Svt.makeGenreLink({id:url.match(/cluster_titles_and_episodes\?cluster=([^?&]+)/)[1]});
    else if (url.match(/title_episodes_by_article_id\?articleId=([0-9]+)/)) {
        var ArticleId = url.match(/title_episodes_by_article_id\?articleId=([0-9]+)/)[1];
        // EpisodeLink for Show Id....
        return Svt.makeEpisodeLink({articleId:ArticleId});
    }
    else if (url.match(/www.svtplay.se\/([^\/]+)$/))
        return Svt.makeShowLink({slug:url.match(/www.svtplay.se\/([^\/]+)$/)[1]});
    return url;
};

Svt.decodeMain = function(data, extra) {

    data = JSON.parse(data.responseText).data.startForSvtPlay.selections;
    var RecommendedIndex, PopularIndex;
    Svt.sections = [];
    for (var k=0; k < data.length; k++) {
        if (data[k].id.match(/live/i))
            continue;

        if (data[k].id.match(/recomm/i)) {
            RecommendedIndex = k;
            continue;
        }
        if (data[k].id.match(/popul/i))
            PopularIndex = k;

        Svt.sections.push({name:data[k].name, url:extra.url, id:data[k].id});
    }

    Svt.section_max_index = Svt.sections.length-1;
    $('#a-button').text(Svt.getNextSectionText());

    extra.recommended_links = Svt.decodeRecommended(data[RecommendedIndex].items, extra);
    Svt.decode(data[PopularIndex].items, extra);

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeSection = function(data, extra) {
    var Section = Svt.sections[Svt.getSectionIndex().current];
    data = JSON.parse(data.responseText).data.startForSvtPlay.selections;
    for (var k=0; k < data.length; k++) {
        if (data[k].id == Section.id) {
            Svt.decode(data[k].items, extra);
            break;
        }
    }

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeCategories = function (data, extra) {

    try {
        var Name;
        var Link;
        var ImgLink = null;
        var Index = Svt.getCategoryIndex().current;

        data = JSON.parse(data.responseText).data;
        switch (Index) {
        case 0:
        case 2:
            if (Index == 0)
                data = data.genres;
            else
                data = data.genresSortedByName.genres;

            data.sort(function(a, b) {
                if (b.name.toLowerCase() > a.name.toLowerCase())
                    return -1;
                return 1;
            });
            for (var k=0; k < data.length; k++) {
                categoryToHtml(data[k].name,
                               Svt.getThumb(data[k]),
                               Svt.getThumb(data[k], 'large'),
                               Svt.makeGenreLink(data[k])
                              );
            }
            break;

        case 1:
            data = data.startForSvtPlay.selections;
            for (var j=0; j < data.length; j++) {
                categoryToHtml(data[j].name,
                               Svt.getThumb(data[j].items[0]),
                               Svt.getThumb(data[j].items[0], 'large'),
                               addUrlParam(extra.url,'collection_id', data[j].id)
                              );
            }
            break;

        case 3:
            data = data.programAtillO.flat;
            data.sort(function(a, b) {
                if (b.name.toLowerCase() > a.name.toLowerCase())
                    return -1;
                return 1;
            });
            ImgLink = null;
            for (var l=0; l < data.length; l++) {
                Name = data[l].name;
                if (data[l].urls.svtplay.match(/\/video\//)) {
                    toHtml({name: Name,
                            link: Svt.makeEpisodeLink(data[l]),
                            link_prefix: '<a href="details.html?ilink='
                           });
                } else {
                    Link = Svt.makeShowLink(data[l]);
                    showToHtml(Name, ImgLink, Link);
                }
            }
            break;
        }
        data = null;
    } catch(err) {
        Log('Svt.decodeCategories Exception:' + err.message + ' data:' + JSON.stringify(data));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeCategoryDetail = function (data, extra) {

    var CollectionId = getUrlParam(extra.url, 'collection_id');
    if (CollectionId)
        return Svt.decodeCollections(CollectionId, data, extra);

    var Name = getUrlParam(getLocation(extra.refresh), 'catName');
    var Slug = decodeURIComponent(getLocation(extra.refresh)).match(/(genre|cluster)"[^"]+"([^"]+)/)[2];
    var TabsUrl = Svt.makeApiLink('GenreLists',
                                  '{"genre":["' + Slug + '"]}',
                                  '90dca0b51b57904ccc59a418332e43e17db21c93a2346d1c73e05583a9aa598c'
                                 );
    var DetailIndex = Svt.getCategoryDetailIndex();
    var DecodeAndComplete = function(data, extra) {
        Svt.decode(data, extra);
        if (extra.cbComplete)
            extra.cbComplete();
    };

    switch (DetailIndex.current) {
    case 0:
        data = JSON.parse(data.responseText).data.genres[0].selectionsForWeb[0].items;
        // Initiate Tabs before decoding Category Details.
        requestUrl(TabsUrl,
                   function(status, tabs_data) {
                       Svt.decodeCategoryTabs(Name, Slug, tabs_data, TabsUrl);
                       DecodeAndComplete(data, extra);
                   }
                  );
        break;

    default :
        var Current = Svt.category_details[DetailIndex.current];
        if (!Current || Slug != Current.slug) {
            // Wrong Category - must re-initiate Tabs data.
            return requestUrl(TabsUrl, function(status,data) {
                Svt.decodeCategoryTabs(Name, Slug, data, TabsUrl);
                // Now re-fetch current index
                extra.url = Svt.category_details[DetailIndex.current].url;
                requestUrl(extra.url, function(status,data) {
                    Svt.decodeCategoryDetail(data,extra);
                });
            });
        }
        // Find items matching current Tab
        data = JSON.parse(data.responseText).data.genres[0];
        if (data.relatedGenres)
            data = data.relatedGenres;
        else {
            data = data.selectionsForWeb;
            for (var k=0; k < data.length; k++) {
                if (Current.id == data[k].id) {
                    data = data[k].items;
                    break;
                }
            }
        }
        if (Current.recommended) {
            // Fetch recommended and merge with Popular
            requestUrl(Svt.makeApiLink('GenrePage',
                                       '{"cluster":["' + Slug + '"]}',
                                       '5127949eadc41dd7f7c5474dcfc26c2ab6ea0fb10e17c7cd9885df3576759825'
                                      ),
                       function(status, recommended_data) {
                           recommended_data = JSON.parse(recommended_data.responseText).data.genres[0].selectionsForWeb[0].items.slice(0,10);
                           extra.recommended_links = Svt.decodeRecommended(recommended_data);
                           DecodeAndComplete(data, extra);
                       });
        } else {
            DecodeAndComplete(data, extra);
        }
    }
};

Svt.decodeCollections = function (id, data, extra) {
    data = JSON.parse(data.responseText).data.startForSvtPlay.selections;
    for (var i=0; i < data.length; i++) {
        if (data[i].id == id) {
            Svt.decode(data[i].items);
            break;
        }
    }

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeCategoryTabs = function (name, slug, data, url) {
    data = JSON.parse(data.responseText).data.genres[0].selectionsForWeb;
    Svt.category_details = [];
    Svt.category_detail_max_index = 0;
    // Add main view
    Svt.category_details.push({name:name, section:'none', slug:slug, url:url});
    var recommended;
    for (var k=0; k < data.length; k++) {
        if (data[k].items.length > 0) {
            recommended = data[k].id.match(/popular/);
            Svt.category_details.push({name:name + ' - ' + data[k].name,
                                       slug:slug,
                                       section: data[k].name,
                                       id: data[k].id,
                                       url: url,
                                       recommended:recommended
                                      });
        }
    }
    // Add Related
    if (Svt.category_details.length > 1)
        Svt.category_details.push({name:name + ' - Relaterat',
                                   slug:slug,
                                   section: 'Relaterat',
                                   url: Svt.makeApiLink('RelatedGenres',
                                                        '{"genre":["' + slug + '"]}',
                                                        '1f49eadb4c7ebd51b66e8975fe24c6eab892c2f57b9154a3760978f239c30534'
                                                       )
                                  });

    Svt.category_detail_max_index = Svt.category_details.length-1;
    Language.fixBButton();
};

Svt.decodeLive = function(data, extra) {
    var ChannelsData = JSON.parse(data.responseText).data.channels.channels;
    var ChannelsUrl  = extra.url;
    data = null;
    extra.url = Svt.getUrl('main'); 
    requestUrl(extra.url,
               function(status, data) {
                   Svt.decodeChannels(ChannelsData, ChannelsUrl);
                   data = JSON.parse(data.responseText).data.startForSvtPlay.selections;
                   for (var k=0; k < data.length; k++) {
                       if (data[k].id.match(/live/i)) {
                           extra.is_live = true;
                           Svt.decode(data[k].items, extra);
                           break;
                       }
                   }
                   data = null;
               },
               {callLoadFinished:true,
                no_cache:true,
                refresh:extra.refresh
               }
              );
};

Svt.decodeShowList = function(data, extra) {
    if (extra.url.match('oppet-arkiv-api'))
        return Oa.decodeShowList(data, extra);

    data = JSON.parse(data.responseText).data;
    if (data.listablesByEscenicId)
        data = data.listablesByEscenicId[0];
    else
        data = data.listablesBySlug[0];

    var showThumb = Svt.getThumb(data);
    var seasons = [];
    var hasClips = false;
    var hasZeroSeason = false;
    var useSeasonName = false;
    var showName;
    var latestSeasonName = extra.user_data && JSON.parse(extra.user_data).latest_season;
    var nextEpsiode = data.nextEpisodeAvailableFormatted;

    if (nextEpsiode && nextEpsiode.length > 0) {
        nextEpsiode = {name:'Nästa avsnitt', is_next:true, next_date:nextEpsiode, image:data.image};
    }

    showName = data.name;
    data = data.associatedContent;
    if (!extra.is_clips && !extra.season && !extra.variant) {
        for (var i=0; i < data.length; i++) {
            if (data[i].type == 'Season') {
                if (!data[i].items[0].item.positionInSeason ||
                    data[i].items[0].item.positionInSeason == '' ||
                    !data[i].name.match(/[0-9]/)
                   )
                    useSeasonName = true;
                seasons.push(data[i].name);
            } else if (data[i].id == 'clips') {
                hasClips = true;
            } else if (data[i].type != 'Upcoming') {
                Log('Unexpected Season type: ' + data[i].type);
            }
            // } else if (data[i].season == 0) {
            //     hasZeroSeason = true;
            // }
        }
        latestSeasonName = null;
        if (seasons.length > 1) {
            if (!useSeasonName) {
                seasons.sort(function(a, b){
                    a = +a.replace(/[^0-9]+/g,'');
                    b = +b.replace(/[^0-9]+/g,'');
                    return b-a;
                });
                latestSeasonName = seasons[0];
            }
            for (var k=0; k < seasons.length; k++) {
                var Season = (useSeasonName) ?
                    seasons[k] :
                    +seasons[k].replace(/[^0-9]+/g,'');
                seasonToHtml(seasons[k],
                             showThumb,
                             extra.url,
                             Season,
                             null,
                             JSON.stringify({latest_season:latestSeasonName})
                            );
            }
        } else if (extra.season!=0 && seasons.length == 1) {
            return callTheOnlySeason(seasons[0], extra.url, extra.loc);
        }
    }

    // Filter episodes belonging to correct season.
    // if (hasZeroSeason || extra.season) {
    //     var Season = (extra.season) ? extra.season : 0;
    //     data.filtered = [];
    //     for (var i=0; i < data.length; i++) {
    //         if (data[i].season == Season)
    //             data.filtered.push(data[i])
    //     }
    //     data = data.filtered;
    // }

    // Add upcoming episodes
    var upcoming = Svt.checkUpoming(data, nextEpsiode, latestSeasonName);

    extra.strip_show = true;
    extra.show_thumb = showThumb;
    extra.show_name = showName;

    if (upcoming && upcoming.last_season_index == -1)
        // No seasons yet...
        Svt.decode(upcoming.items, extra);

    if (extra.season===0 || extra.season || extra.is_clips || (seasons.length && seasons.length < 2)) {
        for (var j=0; j < data.length; j++) {
            if (extra.is_clips && data[j].id=='clips') {
                data = data[j].items;
                break;
            } else if ((''+extra.season) == data[j].name.replace(/[^0-9]+/g,'') ||
                       extra.season == data[j].name ||
                       (extra.season===0 && data[j].type == 'Season')) {
                if (extra.season === 0) {
                    extra.season = (useSeasonName) ?
                        data[j].name :
                        +data[j].name.replace(/[^0-9]+/g,'');
                }
                // Decode upcoming first to avoid messing with multiple episodes
                // with same episode numbers in case part of a new season.
                if (upcoming && j==upcoming.last_season_index)
                    Svt.decode(upcoming.items, extra);
                data = data[j].items;
                break;
            }
        }
        Svt.decode(data, extra);
    }

    if (hasClips)
        clipToHtml(showThumb, extra.url);

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.checkUpoming = function(data, nextEpsiode, latestSeasonName) {
    var upcoming = null;
    var lastSeasonIndex = -1;

    for (var k=0; k < data.length; k++) {
        if (data[k].type=='Upcoming') {
            if (data[k].items && data[k].items.length > 0) {
                // Sort by date, most upcoming first...
                data[k].items.sort(function(a,b) {
                    var start_a = Svt.getAirDate(a.item);
                    var start_b = Svt.getAirDate(b.item);
                    if (start_a > start_b)
                        return 1;
                    else if (start_a < start_b)
                        return -1;
                    else
                        return 0;
                });
                // ...and reverse
                data[k].items.reverse();
                upcoming = data[k];
            } else if (nextEpsiode)
                upcoming = {items:[nextEpsiode]};
        } else if (data[k].type=='Season') {
            if (latestSeasonName) {
                if (data[k].name == latestSeasonName)
                    lastSeasonIndex = k;
            } else if (!upcoming) {
                // Assume Upcoming belongs to the prior season.
                lastSeasonIndex = k;
            } else {
                // Upcoming Index prior to seasons - assume they belong to the season after
                lastSeasonIndex = k;
                break;
            }
        }
    }
    return (upcoming) ? {items:upcoming.items, last_season_index:lastSeasonIndex} : null;
};

Svt.decodeSearchList = function (data, extra) {
    try {
        var Genres = [];
        var Shows = [];
        var Episodes = [];
        data = JSON.parse(data.responseText).data.search;
        // Group hits
        for (var k=0; k < data.length; k++) {
            switch (data[k].item.__typename) {
            case 'Genre':
                Genres.push(data[k]);
                break;

            case 'TvSeries':
            case 'TvShow':
            case 'KidsTvShow':
                Shows.push(data[k]);
                break;

            default:
                Episodes.push(data[k]);
            }
        }
        Svt.decode(Genres);
        Svt.decode(Shows);
        Svt.decode(Episodes);
    } catch(err) {
        Log('Svt.decodeSearchList Exception:' + err.message + ' data[' + k  + ']:' + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.getPlayUrl = function(url, isLive, streamUrl) {

    var video_urls=[], extra = {isLive:isLive, useBitrates:true};

    if (url.match(/=ChannelsQuery/)) {
        extra.use_offset = true;
        streamUrl = SVT_ALT_API_URL + getUrlParam(url,'chId');
    } else if(!streamUrl) {
        streamUrl = url;
    }

    requestUrl(streamUrl,
               function(status, data) {
                   if (Player.checkPlayUrlStillValid(url)) {
                       var videoReferences, subtitleReferences=[], srtUrl=null;
                       if (!streamUrl.match(SVT_ALT_API_URL)) {
                           data = JSON.parse(data.responseText).data.listablesByEscenicId[0];
                           streamUrl = SVT_ALT_API_URL + data.videoSvtId;
                           return Svt.getPlayUrl(url, isLive, streamUrl);
                       } else {
                           data = JSON.parse(data.responseText);
                       }

                       if (data.video && data.video.subtitleReferences)
                           subtitleReferences = data.video.subtitleReferences;
                       else if (data.video && data.video.subtitles)
                           subtitleReferences = data.video.subtitles;
                       else if (data.subtitleReferences)
                           subtitleReferences = data.subtitleReferences;

                       for (var k = 0; k < subtitleReferences.length; k++) {
		           Log('subtitleReferences:' + subtitleReferences[k].url);
                           if (subtitleReferences[k].url.indexOf('.m3u8') != -1)
                               continue;
                           else if (subtitleReferences[k].url.length > 0) {
		               srtUrl = subtitleReferences[k].url;
                               break;
                           }
		       }

                       if (data.video)
                           videoReferences = data.video.videoReferences;
                       else
                           videoReferences = data.videoReferences;

                       // Full if no subtitles?
                       // dash hbbtv not working if ac-3?
                       Svt.sortStreams(videoReferences, srtUrl);
                       for (var j = 0; j < videoReferences.length; j++) {
                           alert('format:' + videoReferences[j].format);
                           video_urls.push(videoReferences[j].url);
                       }
                       alert('video_urls:' + video_urls);

                       Svt.play_args = {urls:video_urls, srt_url:srtUrl, extra:extra};
                       Svt.playUrl();
                   }
               });
};

Svt.sortStreams = function(streams, srtUrl) {
    var formatList=[];
    for (var i = 0; i < streams.length; i++) {
        formatList.push(streams[i].format);
    }
    streams.sort(function(a, b){
        switch (Svt.checkFormat(a,b)) {
        case -1:
            return -1;

        case 1:
            return 1;

        case 0:
            var rank_a = Svt.getStreamRank(a,formatList,srtUrl);
            var rank_b = Svt.getStreamRank(b,formatList,srtUrl);
            return (rank_a < rank_b) ? -1 : 1;
        }
    });
};

Svt.checkFormat = function (a, b) {
    var is_a_dash = (a.format.match(/dash/) != null);
    var is_b_dash = (b.format.match(/dash/) != null);

    // Prefer dash
    if (is_a_dash == is_b_dash)
        return 0;
    else if (is_a_dash)
        return -1;
    else
        return 1
};

Svt.getStreamRank = function(stream, index_list, srtUrl) {

    if (!srtUrl && stream.format == 'dash-full')
        return 0;
    else if (stream.format == 'dash-hbbtv')
        return 1;
    else if (stream.format == 'dash-hbbtv-avc')
        return 2;
    else {
        var base = 1000;
        if (stream.format.match(/hevc/))
            base = base*1000;
        else if (stream.format.match(/cmaf/))
            base = base*100;
        else if (stream.format.match(/-lb/))
            base = base*10;
        else if (stream.format.match(/dash-hbbtv/))
            base = 100;
        return base + index_list.indexOf(stream.format);
    }
};

Svt.playUrl = function() {
    if (Svt.play_args.urls[0].match(/\.(m3u8|mpd)/)) {
	Resolution.getCorrectStream(Svt.play_args.urls[0],
                                    Svt.play_args.srt_url,
                                    Svt.play_args.extra
                                   );
    } else{
        Svt.play_args.extra.cb = function() {Player.playVideo();};
	Player.setVideoURL(Svt.play_args.urls[0],
                           Svt.play_args.urls[0],
                           Svt.play_args.srt_url,
                           Svt.play_args.extra
                          );
    }
};

Svt.tryAltPlayUrl = function(failedUrl, cb) {
    if (Svt.play_args.urls.length == 0)
        return false;
    if (getUrlParam(Svt.play_args.urls[0],"alt")) {
        Svt.play_args.urls[0] = getUrlParam(Svt.play_args.urls[0],"alt").replace(/\|.+$/,'');
    } else {
        Svt.play_args.urls.shift();
    }

    if (Svt.play_args.urls.length > 0) {
        Svt.play_args.extra.cb = cb;
        Svt.playUrl();
        return true;
    }
    else
        return false;
};

Svt.getNextCategory = function() {
    return getNextIndexLocation(3);
};

Svt.getCategoryIndex = function () {
    return getIndex(3);
};

Svt.getNextCategoryDetail = function() {
    var nextLocation    = getNextIndexLocation(Svt.category_detail_max_index);
    var category_detail = Svt.getCategoryDetailIndex();
    if (category_detail.next == 0)
        return 'categories.html';
    var old_detail     = Svt.category_details[category_detail.current].section;
    var new_detail     = Svt.category_details[category_detail.next].section;
    nextLocation =  nextLocation.replace(new RegExp(old_detail+'/$'), '');
    return nextLocation + new_detail + '/';
};

Svt.getCategoryDetailIndex = function () {
    return getIndex(Svt.category_detail_max_index);
};

Svt.getNextCategoryText = function() {
    var language = Language.checkLanguage();

    switch (Svt.getCategoryIndex().next) {
    case 0:
        // Use default
        return null;
    case 1:
        if (language == 'Swedish')
            return 'Utvalt';
        else
            return 'Collections';
        break;
    case 2:
        if (language == 'Swedish')
            return 'Alla Kategorier';
        else
            return 'All Categories';
        break;
    case 3:
        if (language == 'Swedish')
            return 'Alla Program';
        else
            return'All Shows';
        break;
    }
};

Svt.getNextCategoryDetailText = function() {
    if (Svt.category_details.length > Svt.getCategoryDetailIndex().next) {
        var text = Svt.category_details[Svt.getCategoryDetailIndex().next].name;
        var category = decodeURIComponent(getIndexLocation().match(/catName=([^&]+)/)[1]);
        if (text.match(new RegExp('^' + category + '( - .+|$)'))) {
            if(Svt.getCategoryDetailIndex().next == 0)
                // We're at the end - start over with default
                return null;
            else
                return text;
        }
    } else if (Svt.category_details.length == 0)
        return null;
    // Wrong category - keep unchanged
    return 0;
};

Svt.GetChannelThumb = function (Name) {
    return 'https://www.svtplay.se/assets/images/channels/posters/' + Name.toLowerCase().replace(' ','') + '.png';
};

Svt.decodeChannels = function(data, BaseUrl) {
    try {
        var Name;
        var Duration;
        var Link;
        var ImgLink;
        var Background;
        var starttime;
        var endtime;

        for (var k in data) {
            Name = data[k].name.trim();
            Link = addUrlParam(BaseUrl,'chId',data[k].id);
            ImgLink = Svt.GetChannelThumb(Name);
            Background = Svt.getThumb(data[k].running, 'extralarge');
            if (!Background)
                Background = ImgLink;
            starttime = timeToDate(data[k].running.start);
            endtime   = timeToDate(data[k].running.end);
            Duration  = Math.round((endtime-starttime)/1000);
            Name = dateToClock(starttime) + '-' + dateToClock(endtime) + ' ' + data[k].running.name.trim();
            toHtml({name:Name,
                    duration:Duration,
                    is_live:false,
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
        Log('Svt.decodeChannels Exception:' + err.message + ' data[k]:' + JSON.stringify(data[k]));
    }
};

Svt.decodeRecommended = function (data, extra) {
    if (!extra)
        extra = {};
    extra.is_recommended = true;
    var RecommendedLinks = Svt.decode(data, extra);
    extra.is_recommended = false;
    return RecommendedLinks;
};

Svt.decode = function(data, extra) {
    try {
        var html;
        var Titles;
        var Show;
        var Name;
        var Link;
        var LinkPrefix;
        var Description;
        var Duration;
        var ImgLink;
        var LargeImgLink;
        var Background;
        var starttime;
        var IsLive;
        var IsRunning;
        var Season;
        var Episode;
        var Variants = [];
        var SEASON_REGEXP = new RegExp('((s[^s]+song\\s*([0-9]+))\\s*-\\s*)?(.+)','i');
        var Names = [];
        var AltName = null;
        var Shows = [];
        var IgnoreEpisodes = false;
        var Links = [];
        var IsUpcoming = false;

        if (!extra)
            extra = {};
        Show = extra.show_name;
        if (extra.strip_show) {
            var Episodes = [];
            for (var i=0; i < data.length; i++) {
                Episode = Svt.getEpisodeNumber(data[i]);
                if (Episode >= 1) {
                    if (Episodes[Episode]) {
                        Episodes[Episode]++;
                    } else {
                        Episodes[Episode] = 1;
                    }
                } else {
                    IgnoreEpisodes = true;
                }
            }
            if (!IgnoreEpisodes) {
                for (var j=0; j < Episodes.length; j++) {
                    if (Episodes[j] > 1) {
                        IgnoreEpisodes = true;
                        break;
                    }
                }
            }
        }
        for (var k=0; k < data.length; k++) {
            Name = Svt.getItemName(data[k]);
            ImgLink = Svt.getThumb(data[k]);
            LargeImgLink = Svt.getThumb(data[k], 'large');
            Background = Svt.getThumb(data[k], 'extralarge');
            Episode = Svt.getEpisodeNumber(data[k]);
            Season  = extra.season || Svt.getSeasonNumber(data[k]);
            Description = !extra.is_live && data[k].subHeading;
            if (extra.is_recommended) {
                if (data[k].byline)
                    Name = Name + ' - ' + data[k].byline;
            } else {
                AltName = data[k].subHeading && data[k].subHeading.replace(/^[0-9]+\./,'');
                AltName = AltName && AltName.replace(/(avsnitt|del) [0-9]+/i,'').trim();
            }
            // alert('Season: ' + Season + ' Episode: ' +Episode);
            if (data[k].item)
                data[k] = data[k].item;
            Description = Description || data[k].longDescription;
            Duration = data[k].duration;
            IsLive = data[k].live;
            if (IsLive && data[k].live.plannedEnd)
                IsLive = getCurrentDate() < timeToDate(data[k].live.plannedEnd);
            starttime = Svt.getAirDate(data[k]);
            IsUpcoming = extra.strip_show && (data[k].is_next || (starttime > getCurrentDate()));
            starttime = (IsLive || IsUpcoming) ? starttime : null;
            IsRunning = IsLive && (data[k].live.liveNow || getCurrentDate() > starttime);
            if (extra.strip_show && !IgnoreEpisodes) {
                if (!Name.match(/(avsnitt|del)\s*([0-9]+)/i) && Episode) {
                    Description = Name.replace(SEASON_REGEXP, '$4');
                    Name = Name.replace(SEASON_REGEXP, '$1Avsnitt ' + Episode);
                } else {
                    Description = '';
                }
            }

            if (!extra.strip_show) {
                Show = data[k].parent && data[k].parent.name;
                if (!Show || !Show.length) Show = null;
                if (Show || !Name.match(/(avsnitt|del)/i,'')) {
                    if (Episode || Season) 
                        Description = '';
                    if (Episode)
                        Description = 'Avsnitt ' + Episode;
                    if (Season && Episode)
                        Description = 'Säsong ' + Season + ' - ' + Description;
                    else if (Season)
                        Description = 'Säsong ' + Season;
                    if (Show) {
                        Name = Name.replace(/^(((avsnitt|del) [0-9]+)|[0-9.]+\.)/i,'');
                        if (Name.length && !Name.match(new RegExp(Show, 'i')))
                            Name = Show + ' - ' + Name;
                        else if (!Name.length)
                            Name = Show;
                    } else if (AltName && AltName.length > 0 &&
                               AltName != Description && AltName != Name)
                        Name = Name + ' - ' + AltName;
                }
            } else
                Names.push(Name);

            // if (data[k].contentUrl && data[k].contentType != 'titel') {
            LinkPrefix = '<a href="details.html?ilink=';
            if (IsUpcoming) {
                LinkPrefix = '<a href="upcoming.html?ilink=';
                Link = null;
            } else if (extra.variant) {
                Link = null;
                // Find correct variant
                for (var l=0; l < data[k].variants.length; l++) {
                    if (data[k].variants[l].accessibility == extra.variant) {
                        Link = Svt.makeEpisodeLink(data[k].variants[l]);
                        break;
                    }
                }
                if (!Link) continue;
            } else if (data[k].variants) {
                Link = Svt.makeEpisodeLink(data[k].variants[0]);
            } else if (data[k].episode && data[k].episode.variants) {
                // Find correct "variant"
                for (var v=0; v < data[k].episode.variants.length; v++) {
                    if (data[k].episode.variants[v].id == data[k].id) {
                        Link = Svt.makeEpisodeLink(data[k].episode.variants[v]);
                        break;
                    }
                }
            } else if (extra.is_clips) {
                Link = Svt.makeEpisodeLink({articleId:data[k].id});
            } else if (data[k].__typename == 'Single' ||
                       data[k].__typename == 'Episode' ||
                       data[k].__typename == 'Trailer'
                      ) {
                Link = Svt.makeEpisodeLink(data[k]);
            } else if (data[k].__typename == 'Genre') {
                Link = fixCategoryLink(Name, LargeImgLink, Svt.makeGenreLink(data[k]));
                LinkPrefix = makeCategoryLinkPrefix();
            } else {
                Link = Svt.makeShowLink(data[k]);
                LinkPrefix = makeShowLinkPrefix();
            }

            // TODO check how this was done initially...
            if (extra.recommended_links) {
                if (extra.recommended_links.indexOf(Link) != -1) {
                    alert(Name + ' found in recommended_links');
                    continue;
                }
            }

            // What about variants inside episode - is that another "variant"?
            if (!IsUpcoming && !extra.variant && data[k].accessibilities && data[k].variants) {
                for (var m=0; m < data[k].accessibilities.length; m++) {
                    if (Variants.indexOf(data[k].accessibilities[m]) == -1)
                        Variants.push(data[k].accessibilities[m]);
                }
            }
            // Why was this done?
            // if (data[k].versions &&
            //     data[k].versions.length &&
            //     data[k].versions[0].accessService &&
            //     Variants.indexOf(data[k].versions[0].accessService) != -1
            //    )
            //     continue;
            if (extra.is_recommended)
                Links.push(Link);
            Shows.push({name:Name,
                        duration:Duration,
                        is_live:IsLive,
                        is_channel:false,
                        is_running:IsRunning,
                        is_upcoming:IsUpcoming,
                        starttime:starttime,
                        link:Link,
                        link_prefix:LinkPrefix,
                        description:Description,
                        thumb:ImgLink,
                        background:Background,
                        season:Season,
                        episode:Episode,
                        show:Show
                       });
            data[k] = '';
	}
        if (extra.strip_show)
            Svt.sortEpisodes(Shows, Names, IgnoreEpisodes);

        for (var n=0; n < Shows.length; n++) {
            toHtml(Shows[n]);
        }

        if (extra.strip_show) {
            for (var o=0; o < Variants.length; o++) {
                seasonToHtml(Svt.getVariantName(Variants[o]),
                             extra.show_thumb,
                             extra.url,
                             extra.season || 0,
                             Variants[o]
                            );
            }
        }
        return Links;
    } catch(err) {
        Log('Svt.decode Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
};

Svt.getVariantName = function(accessService) {
    if (accessService.match(/audio.*desc/i))
        return 'Syntolkat';
    else if (accessService.match(/^sign/i))
        return 'Teckentolkat';
    else if (accessService.match(/caption/i))
        return 'Textat';
    else
        return accessService;
};

Svt.getSeasonNumber = function(data) {
    var Season = (data.episode &&
                  data.episode.positionInSeason &&
                  data.episode.positionInSeason.match(/^[^0-9]+([0-9]+)[^0-9]+/)
                 );
    if (Season)
        return +Season[1];
    else if (data.analyticsIdentifiers) {
        Season = data.analyticsIdentifiers.viewId.match(/^[^\/]+\/([^\/]+)\//);
        if (Season) {
            return Season[1];
            // Season = Season[1].replace(/[^0-9]/g,'')
            // if (Season.length > 0)
            //     return +Season
        }
    } else if (data.urls && data.urls.svtplay) {
        Season = data.urls.svtplay.match(/sasong-([0-9]+)/);
        if (Season)
            return +Season[1];
    }
    if (data.item)
        return Svt.getSeasonNumber(data.item);
    return null;
};

Svt.getEpisodeNumber = function(data) {
    var Episode, Candidates = [data.slug, data.name, data.heading, data.subHeading];
    for (var i=0; i < Candidates.length; i++) {
        if (Candidates[i]) {
            Episode =
                Candidates[i].match(/.+\-([0-9]+)$/) ||
                Candidates[i].match(/^([0-9]+)\-$/) ||
                Candidates[i].match(/avsnitt\s*([0-9]+)/i) ||
                Candidates[i].match(/^([0-9]+)\./i);
            if (Episode)
                return +Episode[1];
        }
    }
    if (data.urls && data.urls.svtplay) {
        Episode = data.urls.svtplay.match(/(del|avsnitt)-([0-9]+)/);
        if (Episode)
            return  +Episode[2];
    }
    if (data.item)
        return Svt.getEpisodeNumber(data.item);
    return null;
};

Svt.getItemName = function(data) {
    var Name = null;
    if (data.item)
        Name = Svt.getItemName(data.item);
    return Name || data.nameRaw || data.name || data.heading;
};

Svt.getAirDate = function(data) {
    // TODO - should get rid of old stuff here...
    if (data.broadcastStartTime)
        return timeToDate(data.broadcastStartTime);
    else if (data.broadcastDate)
        return timeToDate(data.broadcastDate);
    else if (data.publishDate)
        return timeToDate(data.publishDate);
    else if (data.validFrom)
        return timeToDate(data.validFrom);
    else if (data.live && data.live.start)
        return timeToDate(data.live.start);
    else if (data.next_date)
        return data.next_date;
    else
        return null;
};

Svt.sortEpisodes = function(Episodes, Names, IgnoreEpisodes) {
    Episodes.sort(function(a, b){
        if (a.is_upcoming && b.is_upcoming && +a.starttime != +b.starttime) {
            return (a.starttime > b.starttime) ? -1 : 1;
        }
        if (Svt.IsClip(a) && Svt.IsClip(b)) {
            // Keep SVT sorting amongst clips
            return Names.indexOf(a.name) - Names.indexOf(b.name);
        } else if(Svt.IsClip(a)) {
            // Clips has lower prio
            return 1;
        } else if(Svt.IsClip(b)) {
            // Clips has lower prio
            return -1;
        } else {
            if (IgnoreEpisodes)
                // Keep SVT sorting in case not all videos has an episod number.
                return Names.indexOf(a.name) - Names.indexOf(b.name);
            else if (Svt.IsNewer(a,b))
                return -1;
            else
                return 1;
        }
    });
};

Svt.IsNewer = function(a,b) {
    if (a.season == b.season) {
        return a.episode > b.episode;
    } else if (b.season && a.season) {
        return a.season > b.season;
    } else
        return a.season;
};

// Is this needed any longer? We don't know if a clip or not anylonger
Svt.IsClip = function(a) {
    return false;
};

Svt.requestDateString = function(Callback) {
    httpRequest(Svt.getUrl('live'),
                {cb:function(status,data) {
                    data = JSON.parse(data).data.channels.channels[0].running.start;
                    Callback(data);
                },
                 no_log:true
                });
};
