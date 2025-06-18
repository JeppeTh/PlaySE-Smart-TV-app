// https://www.svtstatic.se/image/small/224/24061018/1571995297

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=ContinueWatchingQuery&variables={"history":[{"id":"1388669-006A","progressSeconds":1217}]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"b571e9100b8601b48a695e9ebec26aa39261564feb1d9af1bbbdfa0b31fb5b4b"}}

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=PersonalRecommendations&variables={"history":["4848918"]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"5c68e176630c5178e75cee30d7b6f34c023adc79b9026f6f545216ffa45507f3"}}

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=TitlePageSimilarContent&variables={"titleSlugs":["al-pitcher-pa-paus"],"abTestVariants":[]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"89b185f33d69105e933e788f9ad12c5f976523c90e6cf67f4ef342e86d84a04e"}}

// https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=VideoPageSimilarContent&variables={"escenicIds":[21744946],"abTestVariants":[]}&extensions={"persistedQuery":{"version":1,"sha256Hash":"b4cb0372ea38ff877bbadde706980d63b09aef8b8448ec3a249cd4810e5f15bd"}}

var SVT_API_BASE = 'https://api.svt.se/contento/graphql?ua=svtplaywebb-play-render-prod-client&operationName=';
var SVT_VIDEO_API_URL = 'https://api.svt.se/video/';

// Temporary? Where to find this URL?
var SVT_ASSETS_URL = 'https://www.svtstatic.se/play/play6/sass/_i-play-cachemap.52d786864ef5c7019890370999ea4ba0.scss';

var Svt = {
    live_url: null,
    sections:[],
    section_max_index:0,
    category_details:[],
    category_detail_max_index:0,
    channel_thumbs:[],
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
    var loc = getIndexLocation();
    if (loc.match(/categoryDetail\.html/) && !loc.match('FionaPage'))
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
    if (loc.match(/categoryDetail\.html/) && !loc.match('FionaPage'))
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
    return addUrlParam(RedirectTls(Link),
                       'extensions',
                       '{"persistedQuery":{"version":1,"sha256Hash":"' + sha + '"}}'
                      );
};

Svt.makeGenreLink = function (data, tab) {
    if (!tab) tab = null;
    return Svt.makeApiLink('CategoryPageQuery',
                           '{"includeFullOppetArkiv":true,"id":"'+data.id+'","tab":' + tab + '}',
                           '00be06320342614f4b186e9c7710c29a7fc235a1936bde08a6ab0f427131bfaf'
                          );
    return Svt.makeApiLink('GenreProgramsAO',
                           '{"genre":["' + data.id + '"]}',
                           '189b3613ec93e869feace9a379cca47d8b68b97b3f53c04163769dcffa509318'
                          );
};

Svt.makeSectionLink = function (id) {
    return Svt.makeApiLink('GridPage',
                           '{"includeFullOppetArkiv":true,"selectionId":"'+id+'"}',
                           'a8248fc130da34208aba94c4d5cc7bd44187b5f36476d8d05e03724321aafb40'
                          );
};

Svt.makeCollectionLink = function (id) {
    return Svt.makeApiLink('FionaPage',
                           '{"includeFullOppetArkiv":true,"selectionId":"'+id+'"}',
                           'dc8f85e195903fe6227a76ec1e1d300d470ee8ea123bea6bee26215cc6e4959d'
                          );
};

Svt.makeShowLink = function (data) {
    var Link = data.slug;
    if (!Link && data.contentUrl)
        Link = data.contentUrl.match(/video\/[0-9]+\/([^\/]+)/)[1];
    else if (!Link && data.urls)
        Link = data.urls.svtplay.replace(/^\//, '');

    return Svt.makeApiLink('DetailsPageQuery',
                           '{"includeFullOppetArkiv":true,"path":"/' + Link + '"}',
                           'e240d515657bbb54f33cf158cea581f6303b8f01f3022ea3f9419fbe3a5614b0'
                          );
};

Svt.makeSearchLink = function (query) {
    return Svt.makeApiLink('SearchPage',
                           '{"query":"' + query + '"}',
                           'f097c31299aa9b4ecdc4aaaf98a14444efda5dfbbc8cdaaeb7c3be37ae2b036a'
                          );
};

Svt.makeEpisodeLink = function (data, fallback) {
    if (typeof(data) === 'string') {
        return Svt.makeApiLink('DetailsPageQuery',
                               '{"includeFullOppetArkiv":true,"path":"' + data + '"}',
                               'e240d515657bbb54f33cf158cea581f6303b8f01f3022ea3f9419fbe3a5614b0'
                              );
    } else if (data.urls && data.urls.svtplay) {
        return Svt.makeEpisodeLink(data.urls.svtplay, fallback);
    }
};

Svt.getThumb = function(data, size) {

    if (data.images) {
        for (var key in data.images) {
            if (key.match(/wide$/)) {
                data.image = data.images[key];
                break;
            }
        }
    } else if (!data.image && data.item) {
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
    return RedirectTls('https://www.svtstatic.se/image/' + size + '/' + data.id + '/' + data.changed);
};

Svt.getHighlightThumb = function(id) {
    var size = 'small/' + HIGHLIGHT_THUMB_WIDTH;
    return RedirectTls('https://www.svtstatic.se/image/' + size + '/' + id);
};

Svt.isPlayable = function (url) {
    return url.match(/(video|klipp)/);
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
        return 'PopulÃ¤rt';

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
    var start=0;
    var end=0;
    var Show = null;
    var isLive = false;
    var Season=null;
    var AltSeason=null;
    var Episode=null;
    var EpisodeName=null;
    var Variant=null;
    var Related=null;
    var Highlights=null;
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
	        ImgLink = Svt.GetChannelThumb(data.id);
            start = timeToDate(data.running.start);
            end = timeToDate(data.running.end);
            VideoLength = Math.round((end-start)/1000);
            VideoLength = dataLengthToVideoLength(null,VideoLength)
            AirDate = dateToClock(start) + '-' + dateToClock(end);
            Title = AirDate + ' ' + Name;
            isLive = true;
            NotAvailable = (start - getCurrentDate()) > 60*1000;
        } else {
            data = JSON.parse(data.responseText).data.detailsPageByPath;
            ImgLink = Svt.getThumb(data, 'large');
            Description = data.description;
            NotAvailable = data.isUpcomingLive;
            AltSeason = Svt.getInconsistenSeason(data);
            if (data.item.parent && data.item.parent.__typename != 'Single') {
                Show = {name : data.item.parent.name,
                        url  : Svt.makeShowLink(data.item.parent),
                        thumb: Svt.getThumb(data.item.parent),
                        label : Svt.getNextAirDay(data)
                       };
            } else if (data.categories && data.categories.length > 0) {
                Show = data.categories[0];
                Show = {name        : Show.heading,
                        url         : Svt.makeGenreLink(Show, '"all"'),
                        thumb       : Svt.getThumb(data, 'small'),
                        large_thumb : ImgLink,
                        is_category : true
                       };
                if (Svt.getRelatedData(data))
                    Related = makeRelatedLink(url);
            }
            data = data.item;
            Season = Svt.getSeasonNumber(data);
            if (AltSeason && AltSeason != Season && AltSeason != ('SÃ¤song '+Season)) {
                alert('Season: ' + Season + ' AltSeason:' + AltSeason)
                Season = AltSeason;
            }
            Episode = Svt.getEpisodeNumber(data);
            EpisodeName = data.name;
            if (data.__typename && data.__typename == 'Episode')
                Variant = null;
            else
                Variant = data.accessibilities;
            if (Variant && Variant[0] != 'Default')
                Variant = Variant[0];
            else
                Variant = null;
            Name = data.name;
            if (Show && Show.name != Name)
                Name = Show.name + ' - ' + Name;
            Title = Name;
            AirDate = Svt.getAirDate(data);
            VideoLength = data.durationFormatted;
            VideoLength = VideoLength && VideoLength.replace(/ tim/,' h');
            start = AirDate;
            if (data.validTo)
                end = timeToDate(data.validTo);
            if (!VideoLength && start && end) {
                VideoLength = Math.round((end-start)/1000);
                VideoLength = dataLengthToVideoLength(null,VideoLength);
            }
            NotAvailable = (getCurrentDate() < start);
            isLive = data.live && (end > getCurrentDate());
            if (!isLive && data.validTo) {
		AvailDate = timeToDate(data.validTo);
                var hoursLeft = Math.floor((AvailDate-getCurrentDate())/1000/3600);
                AvailDate = dateToHuman(AvailDate);
                if (hoursLeft > 24)
                    AvailDate = AvailDate + ' (' + Math.floor(hoursLeft/24) + ' dagar kvar)';
                else
                    AvailDate = AvailDate + ' (' + hoursLeft + ' timmar kvar)';
            }
            if (data.highlights && data.highlights.length > 0) {
                Highlights = [];
                for (var i in data.highlights) {
                    Highlights.push(
                        {name:data.highlights[i].name,
                         seconds: data.highlights[i].positionInSeconds,
                         thumb: Svt.getHighlightThumb(data.highlights[i].thumbnailId)
                        }
                    );
                }
            }
        }
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
            start         : start,
            duration      : VideoLength,
            description   : Description,
            not_available : NotAvailable,
            thumb         : ImgLink,
            season        : Season,
            variant       : Variant,
            episode       : Episode,
            episode_name  : EpisodeName,
            parent_show   : Show,
            related       : Related,
            highlights    : Highlights
    };
};

Svt.getShowData = function(url, data) {

    var Name='';
    var Genre = Name;
    var ImgLink='';
    var Description='';
    var Related = null;

    try {
        data = JSON.parse(data.responseText).data.detailsPageByPath;

        if (url.match(/title_clips_by_title_article_id/)) {
            data = data[0];
            Name = 'Klipp';
        } else
            Name = data.item.name.trim();

        if (!myLocation.match(/(related|variant|season|clips)=/)) {
            if (Svt.getRelatedData(data))
                Related = makeRelatedLink(url);
        }

        ImgLink = Svt.getThumb(data, 'large');
	Description = data.item.shortDescription;
        if (Description && data.description.indexOf(Description) == -1)
            Description = '<p>' + Description + '</p>' + data.description;
        else
            Description = data.description;
        Genre = [];
        for (var i=0; i < data.categories.length; i++) {
            Genre.push(data.categories[i].heading);
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
            thumb         : ImgLink,
            related       : Related
           };
};

Svt.getRelatedData = function(data) {
    if (data.associatedContent) {
        for (var i in data.associatedContent) {
            if (data.associatedContent[i].id == 'related') {
                return data.associatedContent[i];
            }
        }
    }
    return null
};

Svt.getUrl = function(tag, extra) {
    switch (tag.replace(/\.html.+/,'.html')) {
    case 'main':
        httpRequest(RedirectTls(SVT_ASSETS_URL),
                    {cb:function(status,data) {
                        if (data) {
                            Svt.channel_thumbs = data.match(/\/\/.+channels\/posters\/.+-[0-9]+.+png/mg);
                            Svt.channel_thumbs = 'https:' + Svt.channel_thumbs.join('\nhttps:');
                        }
                    }});
        return Svt.getStartPageUrl();

    case 'section':
        return Svt.getSectionUrl(extra.location);

    case 'categories':
        return Svt.getCategoryUrl();

    case 'categoryDetail':
        return Svt.getCategoryDetailsUrl(extra.location);

    case 'live':
        return Svt.makeApiLink('ChannelsQuery',
                               '{}',
                               'bb1706ce58d8d90eb2dbbaa249aaba7fa2f509e3aff4939f26b907cfefe1d758'
                              );

    case 'searchList':
        return Svt.makeSearchLink(extra.query);

    default:
        alert('Default:' + tag);
        return tag;
    }
};

Svt.getStartPageUrl = function() {
    return Svt.makeApiLink('StartPage',
                           '{"includeFullOppetArkiv":true}',
                           'c5c2abc16e150b98857cf7e6e51be52e22e47b0187795b428a24bbeab937c63a'
                          );
}
Svt.getSectionUrl = function(location) {
    if (location.match(/related\.html/)) {
        return getUrlParam(location, 'url');
    }

    var index = location.match(/tab_index=([0-9]+)/)[1];
    return Svt.sections[index].url;
};

Svt.getCategoryUrl = function() {
    switch (Svt.getCategoryIndex().current) {
    case 0:
        return Svt.makeApiLink('MainGenres',
                               '{}',
                               '65b3d9bccd1adf175d2ad6b1aaa482bb36f382f7bad6c555750f33322bc2b489'
                              );
    case 1:
        return Svt.getStartPageUrl();

    case 2:
        return Svt.makeApiLink('AllGenres',
                               '{}',
                               '6bef51146d05b427fba78f326453127f7601188e46038c9a5c7b9c2649d4719c'
                              );
    case 3:
        return Svt.makeApiLink('ProgramsListing',
                               '{"includeFullOppetArkiv":true}',
                               '17252e11da632f5c0d1b924b32be9191f6854723a0f50fb2adb35f72bb670efa'
                              );
    }
};

Svt.getCategoryDetailsUrl = function(location) {
    var DetailIndex = Svt.getCategoryDetailIndex();
    switch (DetailIndex.current) {
    case 0:
        return location;

    default:
        if (DetailIndex.current > Svt.category_detail_max_index) {
            // Lets sort it when response is received.
            if (Svt.category_details.length > 0)
                return Svt.category_details[0].url;
            else
                return location;
        }
        return Svt.category_details[DetailIndex.current].url;
    }
};

Svt.upgradeUrl = function(url) {
    // sha256Hash
    // CategoryPageQuery
    url =  url.replace('8310718ae92359ab2d84968ccbe4a92824dd7684f612119007b1159a4c358ec0',
                       '00be06320342614f4b186e9c7710c29a7fc235a1936bde08a6ab0f427131bfaf'
                      );
    // DetailsPageQuery
    url =  url.replace('d4539b09f69378792486cf87e676af62e9f8ac6de274de616c58b93e86b26da1',
                       'e240d515657bbb54f33cf158cea581f6303b8f01f3022ea3f9419fbe3a5614b0'
                      );

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
    else if (url.match(/=TitlePage/)) {
        var slug = getUrlParam(url,'variables').match(/titleSlugs":\["([^"]+)/);
        if (slug && slug[1])
            return Svt.makeShowLink({slug:slug[1]});
        else
            Log('Upgrade failed for:' + url);
    } else if (url.match(/=GenreProgramsAO/)) {
        var genre = getUrlParam(url,'variables').match(/genre":\["([^"]+)/);
        if (genre && genre[1]) {
            return Svt.makeGenreLink({id:genre[1]});
        } else
            Log('Upgrade failed for:' + url);
    }
    return RedirectTls(url);
};

Svt.decodeMain = function(data, extra) {

    data = JSON.parse(data.responseText).data.startForSvtPlay.selections;
    var RecommendedIndex, PopularIndex;
    Svt.sections = [];
    for (var k=0; k < data.length; k++) {
        if (!data[k].items || data[k].items.length == 0)
            continue;

        if (data[k].id.match(/live/i)) {
            Svt.live_url = Svt.makeCollectionLink(data[k].id);
            continue;
        }

        if (data[k].id.match(/recomm/i)) {
            RecommendedIndex = k;
            continue;
        }

        if (data[k].analyticsIdentifiers &&
            data[k].analyticsIdentifiers.listType == 'redaktionell')
            continue;

        if (data[k].id.match(/popul/i)) {
            PopularIndex = k;
            continue;
        }

        // var Link = Svt.makeCollectionLink(data[k].id)
        // Svt.sections.push({name:data[k].name, url:Link});
        Svt.sections.push({name:data[k].name, url:extra.url, id:data[k].id});
    }
    Svt.sections.unshift({name : data[PopularIndex].name,
                          url  : extra.url,
                          id   : data[PopularIndex].id}
                        );
    Svt.section_max_index = Svt.sections.length-1;
    $('#a-button').text(Svt.getNextSectionText());

    extra.recommended_links = Svt.decodeRecommended(data[RecommendedIndex].items, extra);
    Svt.decode(data[PopularIndex].items, extra);

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeSection = function(data, extra) {
    if (extra.is_related) {
        return Svt.decodeRelated(data, extra);
    }

    // An alertnative is to use GridPage - but slower.
    // data = JSON.parse(data.responseText).data.selectionById.items;
    // Svt.decode(data, extra);
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
                data = data.genresInMain.genres;
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
                if (data[j].analyticsIdentifiers &&
                    data[j].analyticsIdentifiers.listType == 'redaktionell') {
                    categoryToHtml(data[j].name,
                                   Svt.getThumb(data[j].items[0]),
                                   Svt.getThumb(data[j].items[0], 'large'),
                                   Svt.makeCollectionLink(data[j].id)
                                  );
                }
            }
            break;

        case 3:
            data = data.programAtillO.selections;
            data.items = [];
            for (var m=0; m < data.length; m++)
                data.items = data.items.concat(data[m].items);
            data = data.items;
            data.sort(function(a, b) {
                if (b.heading.toLowerCase() > a.heading.toLowerCase())
                    return -1;
                return 1;
            });
            ImgLink = null;
            for (var l=0; l < data.length; l++) {
                Name = data[l].heading;
                data[l] = data[l].item;
                if (data[l].urls.svtplay.match(/\/video\//)) {
                    toHtml({name: Name,
                            link: Svt.makeEpisodeLink(data[l].urls.svtplay),
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

    if (extra.url.match('FionaPage'))
        return Svt.decodeCollections(data, extra);

    var Name = getUrlParam(getLocation(extra.refresh), 'catName');
    var Slug = decodeURIComponent(getLocation(extra.refresh)).match(/id":"([^"]+)"/)[1];
    var DetailIndex = Svt.getCategoryDetailIndex();
    var variables = null;

    // Check if Svt.category_details are up to data
    if (DetailIndex.current != 0) {
        var Current = Svt.category_details[DetailIndex.current];
        if (!Current || Slug != Current.slug) {
            alert('WRONG CATEGORY_DETAILS');
            // Wrong Category - must re-initiate Tabs data.
            var SlugUrl = Svt.makeGenreLink({id:Slug});
            return requestUrl(SlugUrl,
                              function(status, data) {
                                  // Re-initiate tabs
                                  data = JSON.parse(data.responseText).data.categoryPage;
                                  data = data.lazyLoadedTabs;
                                  Svt.decodeCategoryTabs(Name, Slug, data, SlugUrl);
                                  // Re-fetch current index
                                  extra.url = Svt.category_details[DetailIndex.current].url;
                                  requestUrl(extra.url, function(status,data) {
                                      Svt.decodeCategoryDetail(data,extra);
                                  });
                              });
        }
    }
    data = JSON.parse(data.responseText).data.categoryPage;
    data = data && data.lazyLoadedTabs;

    if (DetailIndex.current == 0) {
        if (data && data.length > 0 && data[0].slug != 'all') {
            // In case of History resume/Details we end up directly in A-Ö (tab=all)
            variables = getUrlParam(extra.url,'variables') || {};
            if (JSON.parse(variables).tab == 'all')
                DetailIndex.current = 1;
            else
                // Start by initiating the tabs.
                Svt.decodeCategoryTabs(Name, Slug, data, extra.url);
        } else {
            // This category has no tabs.
            Svt.category_details = [];
            Svt.category_detail_max_index = 0;
        }
    }

    if (Svt.category_detail_max_index == 0 || DetailIndex.current == 1) {
        // A-Ö
        if (DetailIndex.current == 1) {
            for (var k=0; k < data.length; k++) {
                if (data[k].slug == 'all') {
                    data = data[k];
                    break;
                }
            }
        }
        else
            data = data && data[0];
        data = data && data.selections[0].items;
    } else if (DetailIndex.current == 0) {
        // Recommended + Popular
        data = data && data[0].selections;
        for (var k=0; k < data.length; k++) {
            if (data[k].id.match(/recomm/)) {
                extra.recommended_links = Svt.decodeRecommended(data[k].items);
                break
            }
        }
        var popular_index = -1;
        for (var k=0; k < data.length; k++) {
            if (data[k].name.match(/^popul[^ ]+$/i)) {
                popular_index = k;
                break
            }
        }
        data = (popular_index != -1) ? data[popular_index].items : [];
    } else if (!Current.related) {
        // Other Tabs
        data = data[0].selections;
        for (var k=0; k < data.length; k++) {
            if (Current.id == data[k].id) {
                data = data[k].items;
                break;
            }
        }
    }

    if (Current && Current.related) {
        data = data[0].selections;
        for (var k=0; k < data.length; k++) {
            if (data[k].analyticsIdentifiers.listType == 'redaktionell' &&
                !data[k].name.match(/(senaste$|^popul[^ ]+$)/i)
               ) {
                categoryToHtml(data[k].name,
                               Svt.getThumb(data[k].items[0]),
                               Svt.getThumb(data[k].items[0], 'large'),
                               Svt.makeCollectionLink(data[k].id)
                              );
            }
        }
    } else {
        Svt.decode(data, extra);
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeRelated = function (data, extra) {
    data = JSON.parse(data.responseText).data.detailsPageByPath;
    Svt.decode(Svt.getRelatedData(data).items, extra);
    for (var i in data.categories) {
        categoryToHtml(data.categories[i].heading,
                       Svt.getThumb(data),
                       Svt.getThumb(data, 'large'),
                       Svt.makeGenreLink({id:data.categories[i].id})
                      );
    }
    data = null;
    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeCollections = function (data, extra) {
    data = JSON.parse(data.responseText).data.selectionById.items;
    Svt.decode(data);

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.decodeCategoryTabs = function (name, slug, data, url) {
    Svt.category_details = [];
    Svt.category_detail_max_index = 0;
    // Add main view
    Svt.category_details.push({name:name, section:'none', slug:slug, url:url});
    if (data.length > 1) {
        // Add A-Ö
        for (var j=0; j < data.length; j++) {
            if (data[j].slug == 'all') {
                Svt.category_details.push(
                    {name: name + ' - ' + data[j].name,
                     slug: slug,
                     section: data[j].name,
                     url: Svt.makeGenreLink({id:slug}, '"' + data[j].slug + '"')
                    }
                );
                break;
            }
        }
    }
    var selections = data[0].selections;
    for (var k=0; k < selections.length; k++) {
        if (selections[k].id.match(/(recomm|popul[^ ]+$)/))
            continue;
        if (selections[k].analyticsIdentifiers.listType == 'redaktionell') {
            if (!selections[k].name.match(/senaste$/i))
                continue;
        }
        if (selections[k].items.length > 0) {
            Svt.category_details.push({name: name + ' - ' + selections[k].name,
                                       slug: slug,
                                       section: selections[k].name,
                                       id: selections[k].id,
                                       url: url
                                      });
        }
    }
    // Add Related
    Svt.category_details.push({name: name + ' - Relaterat',
                               slug: slug,
                               section: 'Relaterat',
                               url: url,
                               related: true
                              });

    Svt.category_detail_max_index = Svt.category_details.length-1;
    Language.fixBButton();
};

Svt.decodeLive = function(data, extra) {
    var ChannelsData = JSON.parse(data.responseText).data.channels.channels;
    var ChannelsUrl  = extra.url;
    data = null;
    extra.url = Svt.live_url;
    requestUrl(extra.url,
               function(status, data) {
                   Svt.decodeChannels(ChannelsData, ChannelsUrl);
                   data = JSON.parse(data.responseText).data.selectionById.items;
                   extra.is_live = true;
                   Svt.decode(data, extra);
                   data = null;
               },
               {cbComplete: extra.cbComplete,
                no_cache:true,
                refresh:extra.refresh
               }
              );
};

Svt.useLiveRefresh = function() {
    return true;
};

Svt.decodeShowList = function(data, extra) {
    if (extra.is_related)
        return Svt.decodeRelated(data, extra);

    data = JSON.parse(data.responseText).data.detailsPageByPath;

    var showThumb = Svt.getThumb(data);
    var seasons = [];
    var hasClips = false;
    var hasRelated = false;
    var relatedThumb = null;
    var hasZeroSeason = false;
    var useSeasonName = false;
    var seasonTitle = getUrlParam(extra.loc, 'title');
    var showName;
    var latestSeasonName = extra.user_data && JSON.parse(extra.user_data).latest_season;
    var nextEpsiode = data.item.nextEpisodeAvailableFormatted;

    if (nextEpsiode && nextEpsiode.length > 0) {
        nextEpsiode = {name:'NÃ¤sta avsnitt', is_next:true, next_date:nextEpsiode, image:data.image};
    }

    showName = data.item.name;
    data = data.associatedContent;
    if (!extra.is_clips && !extra.season && !extra.variant) {
        for (var i=0; i < data.length; i++) {
            if (data[i].selectionType.match(/(Season|productionPeriod)/i)) {
                if (!data[i].items || data[i].items.length == 0)
                    continue;
                if (!data[i].items[0].item.positionInSeason ||
                    data[i].items[0].item.positionInSeason == '' ||
                    !Svt.getSeasonDigits(data[i].name)
                   )
                    useSeasonName = true;
                seasons.push(data[i].name);
            } else if (data[i].id.match(/^clips/)) {
                hasClips = true;
            } else if (data[i].id == 'related' && data[i].items.length > 0) {
                hasRelated = true;
                relatedThumb = Svt.getThumb(data[i].items[0]);
            } else if (data[i].selectionType.match(/accessibility/i)) {
                continue;
            } else if (!data[i].selectionType.match(/Upcoming/i)) {
                Log('Unexpected Season type: ' + data[i].selectionType);
            }
            // } else if (data[i].season == 0) {
            //     hasZeroSeason = true;
            // }
        }
        latestSeasonName = null;
        if (seasons.length > 1) {
            seasons.reverse();
            if (!useSeasonName) {
                seasons.sort(function(a, b){
                    return Svt.getSeasonDigits(b)-Svt.getSeasonDigits(a);
                });
                latestSeasonName = seasons[0];
            }
            for (var k=0; k < seasons.length; k++) {
                var Season = (useSeasonName) ? seasons[k] : Svt.getSeasonDigits(seasons[k]);
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
            if (extra.is_clips && data[j].id.match(/^clips/)) {
                data = data[j].items;
                break;
            } else if (Svt.isSameSeason(extra.season, data[j].name) ||
                       (extra.season===0 && data[j].selectionType.match(/(Season|productionPeriod)/i))) {
                if (extra.season === 0) {
                    extra.season = (useSeasonName) ?
                        data[j].name :
                        Svt.getSeasonDigits(data[j].name);
                } else if (data[j].name != seasonTitle && data[j+1] &&
                           Svt.isSameSeason(extra.season, data[j+1].name)
                          )
                    continue;
                // Decode upcoming first to avoid messing with multiple episodes
                // with same episode numbers in case part of a new season.
                if (upcoming) {
                    var alt_season = null;
                    if (data[j].items && data[j].items.length > 0)
                        alt_season = Svt.getSeasonNumber(data[j].items[0]);
                    if ((upcoming.season &&
                         (Svt.isSameSeason(extra.season,upcoming.season) ||
                          Svt.isSameSeason(alt_season,upcoming.season))) ||
                        (!upcoming.season && j==upcoming.last_season_index)) {
                        Svt.decode(upcoming.items, extra);
                    }
                }
                if (extra.variant) {
                    data = Svt.findVariantSeason(data,j,extra.variant).items;
                } else
                    data = data[j].items;
                break;
            }
        }
        Svt.decode(data, extra);
    }

    if (hasClips)
        clipToHtml(showThumb, extra.url);

    if (hasRelated)
        relatedToHtml(relatedThumb, extra.url);

    if (extra.cbComplete)
        extra.cbComplete();
};

Svt.checkUpoming = function(data, nextEpsiode, latestSeasonName) {
    var upcoming = null;
    var lastSeasonIndex = -1;
    var season = null;

    for (var k=0; k < data.length; k++) {
        if (data[k].selectionType.match(/Upcoming/i)) {
            if (data[k].items && data[k].items.length > 0) {
                if (!season) season = Svt.getSeasonNumber(data[k].items[0]);
                // Sort by date, most upcoming first...
                data[k].items.sort(function(a,b) {
                    if (season && season != Svt.getSeasonNumber(a))
                        alert('multiple seasons');
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
        } else if (data[k].selectionType.match(/(Season|productionPeriod)/i)) {
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
    return (upcoming) ? {items:upcoming.items, season:season, last_season_index:lastSeasonIndex} : null;
};

Svt.findVariantSeason = function(data, index, variant) {
    var SeasonName = data[index].name;
    for (var k=0; k < data.length; k++) {
        if (!data[k].selectionType.match(/accessibility/))
            continue;
        if (!data[k].id.match(variant))
            continue;
        if (data[k].name.match(SeasonName))
            return data[k];
    }
    alert(SeasonName + ' for ' + variant + ' not found!');
    return data[index];
};

Svt.decodeSearchList = function (data, extra) {
    try {
        var Genres = [];
        var Shows = [];
        var Episodes = [];
        data = JSON.parse(data.responseText).data.searchPage.flat;
        // Group hits
        data = (data && data.hits) ? data.hits : [];
        for (var k=0; k < data.length; k++) {
            if (data[k].categoryTeaser)
                Genres.push(data[k].categoryTeaser);
            else if (data[k].teaser && data[k].teaser.item) {
                switch (data[k].teaser.item.__typename) {
                case 'TvSeries':
                case 'TvShow':
                case 'KidsTvShow':
                    Shows.push(data[k].teaser);
                    break;

                default:
                    Episodes.push(data[k].teaser);
                }
            } else {
                Log('Unknown search result: ' + JSON.stringify(data[k]));
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
        streamUrl = SVT_VIDEO_API_URL + getUrlParam(url,'chId');
    } else if(!streamUrl) {
        streamUrl = url;
    }

    requestUrl(RedirectTls(streamUrl),
               function(status, data) {
                   if (Player.checkPlayUrlStillValid(url)) {
                       var videoReferences, subtitleReferences=[], srtUrl=null;
                       if (!streamUrl.match(SVT_VIDEO_API_URL)) {
                           data = JSON.parse(data.responseText).data.detailsPageByPath.video;
                           streamUrl = SVT_VIDEO_API_URL + data.svtId;
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
                           srtUrl = subtitleReferences[k].url;
                           if (subtitleReferences[k].label &&
                               subtitleReferences[k].label.match(/allt/i)
                              )
                               break;
		       }

                       if (data.video)
                           videoReferences = data.video.videoReferences;
                       else
                           videoReferences = data.videoReferences;

                       Svt.sortStreams(videoReferences, srtUrl);
                       videoReferences = Svt.stripDuplicatStreams(videoReferences);
                       for (var j = 0; j < videoReferences.length; j++) {
                           alert('format:' + videoReferences[j].format);
                           video_urls.push(videoReferences[j].url);
                       }
                       alert('video_urls:' + video_urls);
                       if (data.thumbnailMap) {
                           extra.previewThumb =
                           {
                               src:      data.thumbnailMap.url,
                               width:    data.thumbnailMap.thumbnailwidth,
                               height:   data.thumbnailMap.thumbnailheight,
                               rows:     data.thumbnailMap.rows,
                               columns:  data.thumbnailMap.columns,
                               duration: data.thumbnailMap.timeBetweenPicturesInMillis
                           };
                       } else if (!extra.use_offset) {
                           for (var i in videoReferences)
                               if (videoReferences[i].format.match('dash')) {
                                   extra.previewThumbStream = videoReferences[i].url
                                   break;
                               }
                       }
                       Svt.play_args = {urls:video_urls, srt_url:srtUrl, extra:extra};
                       // Seems it's thumbnails that make live streams fail.
                       if (isLive)
                           Svt.play_args.extra.redirect_mpd = true;
                       // AC-3 not supported on older devices.
                       if (deviceYear < 2014) {
                           var content;
                           while (Svt.play_args.urls.length > 1) {
                               content = httpRequest(Svt.play_args.urls[0], {sync:true}).data;
                               if (content.match(/codec.+ac-3/i))
                                   Svt.play_args.urls.shift();
                               else {
                                   if (content.match(/text\/vtt/i))
                                       Svt.play_args.extra.redirect_mpd = true;
                                   break;
                               }
                           }
                       }
                       Svt.playUrl();
                   }
               });
};

Svt.redirectMpd = function(url) {
    var urlPrefix = getUrlPrefix(url);
    content = httpRequest(url, {sync:true}).data;
    // Strip Subtitles
    content = content.replace(/^[ ]*<AdaptationSet[^<]+?contentType="(text|image)"(.+\n)+?.*?<\/AdaptationSet>.*?\n?/mg,'');
    // Need to add urlPrefix as Base.
    content = content.replace(/((^ +)<AdaptationSet)/m,'$2<BaseURL>'+urlPrefix+'</BaseURL>\n$1');
    content = content.replace(/(initialization=")/mg,'$1'+urlPrefix);
    // Upload new content
    var file =  document.getElementById('pluginNetwork').GetMAC() + '.mpd';
    var params = {name:file, data:content};
    var url = 'http://' + GetProxyHost() + '/jtsave/jtnolog';
    var result = httpRequest(url, {sync:true, no_log:true, params:JSON.stringify(params)});
    // Redirect to new content
    url = 'http://' + GetProxyHost() + '/jtread/jtnolog';
    return addUrlParam(url, 'name', file);
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
        return 1;
};

Svt.getStreamRank = function(stream, index_list, srtUrl) {

    if (!srtUrl) {
        // The subtitle format used in dash isn't supported, if no subtitles we
        // can select from more variants.
        if (deviceYear > 2013) {
            // Seems devices > 2013 supports AC-3, prefer that
            if (stream.format == 'dash-avc-51')
                return 0;
            else if (stream.format == 'dash-hbbtv-avc')
                // Not sure if dash-xxx-51 has been ditched.
                // Seems this one contains AC-3, but not so many bandwiths...
                return 1;
        }
        if (stream.format == 'dash-avc')
            // 'dash-avc' contains non AC-3 audio stream needed for older devices.
            // Also more bandwith variants...
            return 2;
    }
    if (stream.format == 'dash-hbbtv')
        // Never contains subtitles which seem to cause issues.
        // In case of AC-3 we're smoked on older devices though.
        return 3;
    else if (stream.format == 'dash-hbbtv-avc')
        return 4;
    else if (stream.format == 'dash-avc')
        return 5;
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
        else if (stream.format == 'dash')
            base = 50;
        return base + index_list.indexOf(stream.format);
    }
};

Svt.stripDuplicatStreams = function(streams) {
    var urls=[], result=[];
    for (var i=0; i < streams.length; i++) {
        if (urls.indexOf(streams[i].url) == -1) {
            urls.push(streams[i].url);
            result.push(streams[i]);
        }
    }
    return result;
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
    if (getUrlParam(Svt.play_args.urls[0],'alt')) {
        Svt.play_args.urls[0] = getUrlParam(Svt.play_args.urls[0],'alt').replace(/\|.+$/,'');
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

Svt.reloadRewind = function() {
    return true;
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
    var old_detail = Svt.category_details[category_detail.current].section;
    var new_detail = Svt.category_details[category_detail.next].section;
    nextLocation = nextLocation.replace(new RegExp(old_detail+'/$'), '');
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

Svt.GetChannelThumb = function (Id) {
    var ThumbRegexp = new RegExp('^http.+' + Id.replace(/^ch-/i,'') + '.*$','img');
    var Thumb = Svt.channel_thumbs.match(ThumbRegexp);
    return RedirectTls(Thumb && Thumb[0]);
};

Svt.decodeChannels = function(data, BaseUrl) {
    try {
        var Name;
        var Duration;
        var Link;
        var ImgLink;
        var Background;
        var start;
        var end;

        for (var k in data) {
            Name = data[k].name.trim();
            Link = addUrlParam(BaseUrl,'chId',data[k].id);
            ImgLink = Svt.GetChannelThumb(data[k].id);
            Background = Svt.getThumb(data[k].running, 'extralarge');
            if (!Background)
                Background = ImgLink;
            start = timeToDate(data[k].running.start);
            end   = timeToDate(data[k].running.end);
            Duration  = Math.round((end-start)/1000);
            Name = dateToClock(start) + '-' + dateToClock(end) + ' ' + data[k].running.name.trim();
            toHtml({name:Name,
                    start: start,
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
        var Byline;
        var Link;
        var LinkPrefix;
        var Description;
        var Duration;
        var ImgLink;
        var LargeImgLink;
        var Background;
        var start;
        var IsLive;
        var IsRunning;
        var Season;
        var Episode;
        var Variants = [];
        var SEASON_REGEXP = new RegExp('((s[^s]+song\\s*([0-9]+))\\s*-\\s*)?(.+)','i');
        var AltName = null;
        var Shows = [];
        var IgnoreEpisodes = false;
        var Links = [];
        var IsUpcoming = false;
        var Label = null;

        if (!data) return;
        if (!extra) extra = {};
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
            Byline = data[k].byline;
            Label = data[k].badge && data[k].badge.text;
            ImgLink = Svt.getThumb(data[k]);
            LargeImgLink = Svt.getThumb(data[k], 'large');
            Background = Svt.getThumb(data[k], 'extralarge');
            Episode = Svt.getEpisodeNumber(data[k]);
            Season  = extra.season || Svt.getSeasonNumber(data[k]);
            Description = !extra.is_live && data[k].subHeading;
            if (!extra.is_recommended) {
                AltName = data[k].subHeading && data[k].subHeading.replace(/^[0-9]+\./,'');
                AltName = AltName && AltName.replace(/(avsnitt|del) [0-9]+/i,'').trim();
                AltName = Svt.stripHtml(AltName);
            }
            // alert('Season: ' + Season + ' Episode: ' +Episode);
            IsLive = data[k].badge && data[k].badge.type.match(/live/i);
            IsRunning = IsLive && !data[k].badge.type.match(/upcoming/i);
            if (data[k].item)
                data[k] = data[k].item;
            Description = Svt.stripHtml(Description || data[k].longDescription);
            Duration = data[k].duration;
            start = Svt.getAirDate(data[k]);
            if (data[k].live) {
                IsLive = true;
                if (data[k].live.plannedEnd) {
                    IsLive = getCurrentDate() < timeToDate(data[k].live.plannedEnd);
                }
                IsRunning = data[k].live.liveNow || getCurrentDate() > start
            }
            if (IsLive && !start && data[k].name.match(/[0-9]+:[0-9]+/)) {
                start = data[k].name.replace(/[^0-9:]+/g, '');
            }
            if (!Duration && start && data[k].live && data[k].live.plannedEnd)
                Duration = timeToDate(data[k].live.plannedEnd) - start;

            IsUpcoming = data[k].is_next || (start > getCurrentDate());
            start = (IsLive || IsUpcoming) ? start : null;
            if (extra.strip_show && !IgnoreEpisodes) {
                if (!Name.match(/(avsnitt|del)\s*([0-9]+)/i) && Episode) {
                    Description = Name.replace(SEASON_REGEXP, '$4');
                    Name = Name.replace(SEASON_REGEXP, '$1Avsnitt ' + Episode);
                } else {
                    Description = '';
                }
            }

            if (!extra.strip_show) {
                Show = data[k].parent;
                if (extra.is_recommended && Show && Show.svtId)
                    Links.push(Show.svtId);
                Show = Show && Show.name;
                if (!Show || !Show.length) Show = null;
                if (Show || !Name.match(/(avsnitt|del)/i,'')) {
                    if (Episode || Season) 
                        Description = '';
                    if (Episode)
                        Description = 'Avsnitt ' + Episode;
                    if (Season && Episode)
                        Description = 'SÃ¤song ' + Season + ' - ' + Description;
                    else if (Season)
                        Description = 'SÃ¤song ' + Season;
                    if (Show) {
                        Name = Name.replace(/^(((avsnitt|del) [0-9]+)|[0-9.]+\.)/i,'');
                        if (Name.length && !safeMatch(Name,Show) && !safeMatch(Show,Name))
                            Name = Show + ' - ' + Name;
                        else if (!Name.length)
                            Name = Show;
                    } else if (AltName && AltName.length > 0 &&
                               AltName != Description && AltName != Name)
                        Name = Name + ' - ' + AltName;
                }
            }
            if (extra.is_recommended && Byline) {
                Name = Name + ' - ' + Byline;
            }

            if (!IsUpcoming && extra.variant) {
                // Make sure variant is correct
                if (!Svt.setupVariant(data[k], extra.variant)) {
                    Log('Wrong variant!');
                    continue;
                }
            }

            // if (data[k].contentUrl && data[k].contentType != 'titel') {
            LinkPrefix = '<a href="details.html?ilink=';
            if (IsUpcoming) {
                Label = null;
                if (data[k].urls.svtplay &&
                    data[k].urls.svtplay.length > 0 &&
                    !data[k].urls.svtplay.match(/null$/)
                   ) {
                    Link = Svt.makeEpisodeLink(data[k]);
                } else {
                    LinkPrefix = '<a href="upcoming.html?ilink=';
                    Link = null;
                }
            } else if (data[k].__typename == 'Single' ||
                       data[k].__typename == 'Episode' ||
                       data[k].__typename == 'Trailer' ||
                       data[k].__typename == 'Teaser' ||
                       data[k].__typename == 'Variant' ||
                       data[k].__typename == 'Clip' ||
                       extra.is_clips
                      ) {
                Link = Svt.makeEpisodeLink(data[k]);
            } else if (data[k].__typename == 'CategoryTeaser') {
                Link = fixCategoryLink(Name, LargeImgLink, Svt.makeGenreLink(data[k]));
                LinkPrefix = makeCategoryLinkPrefix();
            } else {
                Link = Svt.makeShowLink(data[k]);
                LinkPrefix = makeShowLinkPrefix();
            }

            // TODO check how this was done initially...
            if (extra.recommended_links) {
                if (extra.recommended_links.indexOf(Link) != -1 ||
                    extra.recommended_links.indexOf(data[k].svtId) != -1) {
                    alert(Name + ' found in recommended_links');
                    continue;
                }
            }
            // Add variants
            if (!IsUpcoming && !extra.is_related && !extra.variant && data[k].accessibilities) {
                for (var m=0; m < data[k].accessibilities.length; m++) {
                    if (data[k].accessibilities[m] == 'Default')
                        continue;
                    if (Variants.indexOf(data[k].accessibilities[m]) == -1)
                        Variants.push(data[k].accessibilities[m]);
                }
            }
            if (extra.is_recommended)
                Links.push(Link);
            Shows.push({name:Name,
                        label: !IsLive && Label,
                        duration:Duration,
                        is_live:IsLive,
                        is_channel:false,
                        is_running:IsRunning,
                        is_upcoming:IsUpcoming,
                        start:start,
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
            Svt.sortEpisodes(Shows, IgnoreEpisodes);

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

Svt.setupVariant = function(data, variant) {
    if (data.variants) {
        for (var i in data.variants) {
            if (data.variants[i].accessibility &&
                data.variants[i].accessibility == variant
               ) {
                data.urls = data.variants[i].urls;
                data.videoSvtId = data.variants[i].videoSvtId;
                return true
            }
        }
    }
    return false;
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

Svt.getSeasonDigits = function(Name) {
    Name = '' + Name;
    return +(Name.split(/\s*:.+$/)[0].replace(/[^0-9]+/g,''));
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

    if (data.heading) {
        Season = data.heading.match(/^s[^s]+song ([0-9]+):/i);
        Season = (Season) ? +Season[1] : null;
    }

    if (data.item)
        return Svt.getSeasonNumber(data.item) || Season;
    return Season;
};

Svt.getInconsistenSeason = function(data) {
    if (data.video && data.video.svtId && data.associatedContent) {
        var Seasons = data.associatedContent;
        for (var i=0; i < Seasons.length; i++) {
            if (!Seasons[i].items)
                continue;
            for (var j=0; j < Seasons[i].items.length; j++) {
                if (Seasons[i].items[j].item.videoSvtId == data.video.svtId)
                    return Seasons[i].name
            }
        }
    }
};

Svt.getEpisodeNumber = function(data) {
    var Episode, Candidates = [data.slug, data.name, data.heading, data.subHeading];
    for (var i=0; i < Candidates.length; i++) {
        if (Candidates[i]) {
            Episode =
                Candidates[i].match(/^([0-9]+)\-/) ||
                Candidates[i].match(/^([0-9]+)\./) ||
                Candidates[i].match(/.+\-([0-9]+)$/) ||
                Candidates[i].match(/avsnitt\s*([0-9]+)/i);
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

Svt.isSameSeason = function(season, name) {
    return season && (season == Svt.getSeasonDigits(name) || season == name);
};

Svt.getItemName = function(data) {
    var Name = null;
    // TODO keep or not?
    if (!data.heading && data.item)
    // if (data.item)
        Name = Svt.getItemName(data.item);
    return Svt.stripHtml(Name || data.nameRaw || data.name || data.heading);
};

Svt.stripHtml = function(String) {
    return String && String.replace(/\<[^>]+\>([^<]+)\<\/[^>]+>/,'$1');
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

Svt.getNextAirDay = function(data) {
    if (data.associatedContent) {
        var contents = data.associatedContent;
        for (var i=0; i < contents.length; i++) {
            if (contents[i].selectionType.match(/Upcoming/i)) {
                // Sort by date, most upcoming first...
                contents[i].items.sort(function(a,b) {
                    var start_a = Svt.getAirDate(a.item);
                    var start_b = Svt.getAirDate(b.item);
                    if (start_a > start_b)
                        return 1;
                    else if (start_a < start_b)
                        return -1;
                    else
                        return 0;
                });
                return getDay(Svt.getAirDate(contents[i].items[0].item))
            }
        }
    }
};

Svt.sortEpisodes = function(Episodes, IgnoreEpisodes) {
    Episodes.sort(function(a, b){
        if (a.is_upcoming && b.is_upcoming && +a.start != +b.start) {
            return (a.start > b.start) ? -1 : 1;
        }
        if (Svt.IsClip(a) && Svt.IsClip(b)) {
            // Keep SVT sorting amongst clips
            return 0;
        } else if(Svt.IsClip(a)) {
            // Clips has lower prio
            return 1;
        } else if(Svt.IsClip(b)) {
            // Clips has lower prio
            return -1;
        } else {
            if (IgnoreEpisodes)
                // Keep SVT sorting in case not all videos has an episod number.
                return 0;
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
