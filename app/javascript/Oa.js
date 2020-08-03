var Oa = {
};

Oa.getHeaderPrefix = function() {
    return 'Öppet Arkiv';
};

Oa.getMainTitle = function() {
    return 'Rekommenderat';
};

Oa.getSectionTitle = function() {
    return 'Senaste';
};

Oa.getCategoryTitle = function() {
    switch (Oa.getCategoryIndex().current) {
    case 0:
        return 'Kategorier';
    case 1:
        return 'Alla Program';
    }
};

Oa.getCheckedChannelText = function(button) {
    return Oa.getHeaderPrefix().slice(0,-2);
};

Oa.getUnCheckedChannelText = function(button) {
    return Oa.getHeaderPrefix();
};

Oa.keyRed = function() {
    if ($('#a-button').text().indexOf('Re') != -1) {
	setLocation('index.html');
    } else {
	setLocation('Latest.html');
    }
};

Oa.keyGreen = function() {
    if (getIndexLocation().match(/categories\.html/))
        setLocation(Oa.getNextCategory());
    else
        setLocation('categories.html');
};

Oa.keyYellow = function() {
    return;
};

Oa.getAButtonText = function(language) {
    var loc = getIndexLocation();
    if (loc.match(/index\.html/)){
        if(language == 'English'){
	    return 'Latest';
        } else {
	    return 'Senaste';
        }
    } else {
        if(language == 'English'){
	    return 'Recommended';
        } else {
	    return 'Rekommenderat';
        }
    }
};

Oa.getBButtonText = function(language, catLoaded) {
    if (getIndexLocation().match(/categories\.html/))
        return Oa.getNextCategoryText();
    return null;
};

Oa.getCButtonText = function(language) {
    return '';
};

Oa.getDetailsUrl = function(streamUrl) {
    return streamUrl.replace(/&count=[^&]+/,'&sort=date_asc');
};

Oa.getDetailsData = function(url, data) {

    var Name='';
    var Title = Name;
    var ImgLink='';
    var AirDate='';
    var VideoLength = '';
    var Description='';
    var Show = null;
    var Season = null;
    var Episode = null;
    var EpisodeName = null;

    try {
        data = JSON.parse(data.responseText);
        switch (data.contentType) {
        case 'video':
            if (data.programTitle && data.programTitle.length > 0) {
                Show = {name  : data.programTitle.trim(),
                        url   : Oa.makeTagLink(data),
                        thumb : data.thumbnailSmall
                       };
            }//  else if (data.tagList) {
            //     for (var i=0; i < data.tagList.length; i++) {
            //         alert('data.tagList.facet:' + data.tagList[i].facet)
            //         if (data.tagList[i].facet == 'genreFacet') {
            //             alert('Genre');
            //             Show = {name        : data.tagList[i].term.trim(),
            //                     url         : Oa.makeTagLink({tagList:[data.tagList[i]]}),
            //                     thumb       : data.thumbnailSmall,
            //                     large_thumb : data.thumbnailLarge,
            //                     is_category : true
            //                    }
            //             break;
            //         };
            //     }
            // }
            if (data.programTitle == data.title || !data.programTitle) {
                Name = data.title;
                if (Show && Show.name != data.title)
                    Name = Show.name + ' - ' + Name;

            } else {
                Name = data.programTitle + ' - ' + data.title;
            }
            if (data.description)
                Description = data.description.trim();
            Title = Name;
            ImgLink = data.thumbnailLarge;
            if (data.broadcastDate)
                AirDate = timeToDate(data.broadcastDate);
            else if (data.activateDate)
                AirDate = timeToDate(data.activateDate);
            VideoLength = dataLengthToVideoLength(null,data.materialLength);
            Season = data.seasonNumber,
            Episode = data.episodeNumber,
            EpisodeName = data.title.trim();
            data = null;
            return {name          : Name.trim(),
                    title         : Title.trim(),
                    air_date      : AirDate,
                    duration      : VideoLength,
                    description   : Description,
                    thumb         : ImgLink,
                    season        : Season,
                    episode       : Episode,
                    episode_name  : EpisodeName,
                    parent_show   : Show
                   };
            break;

        case null:
        case undefined:
            return Oa.getShowData(data);
            break;

        default:
            alert('Unknown data.contentType:' + data.contentType);
        }
    } catch(err) {
        Log('Oa.getDetails Exception:' + err.message);
        Log('Name:' + Name);
        Log('AirDate:' + AirDate);
        Log('VideoLength:' + VideoLength);
        Log('Description:' + Description);
        Log('NotAvailable:' + NotAvailable);
        Log('ImgLink:' + ImgLink);
    }
};

Oa.getShowData = function(data) {
    var Name='';
    var Genre = Name;
    var ImgLink='';
    var Description='';

    try {
        data = data.entries.sort(function(a, b){return (a.episodeNumber > b.episodeNumber) ? 1 : -1;});
        data = data[0];
        Name = data.programTitle;
        if (!Name || Name.length == 0)
            Name  = data.title;
        ImgLink = data.thumbnailLarge;
	Description = data.summary.trim();
        Genre = [];
        for (var i=0; i < data.tagList.length; i++) {
            switch (data.tagList[i].facet) {
                case 'genreFacet':
                case 'yearFacet':
                Genre.push(data.tagList[i].name.trim());
                break;
            default:
                break;
            }
        }
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
            name          : Name.trim(),
            description   : Description,
            genre         : Genre,
            thumb         : ImgLink
           };
};

Oa.getUrl = function(tag, extra) {
    switch (tag.replace(/\.html.+/,'.html')) {
    case 'main':
        return 'https://origin-www.svt.se/oppet-arkiv-api/frontpage';

    case 'section':
        return 'https://origin-www.svt.se/oppet-arkiv-api/latest?count=50';

    case 'categories':
        return Oa.getCategoryUrl();

    case 'categoryDetail':
        return extra.location;

    // case 'live':
    //     return 'http://www.svtplay.se/kanaler';

    case 'searchList':
        return 'https://origin-www.svt.se/oppet-arkiv-api/search/videos/?count=5000&q=' + extra.query;

    default:
        alert('Default:' + tag);
        return tag;
    }
};

Oa.getCategoryUrl = function() {
    switch (Oa.getCategoryIndex().current) {
    case 1:
        return 'https://www.oppetarkiv.se/program';
    default:
        return 'https://www.oppetarkiv.se/genrer';
    }
};

Oa.decodeMain = function(data, extra) {
    data = JSON.parse(data.responseText);
    var FilterShows = Oa.filterShows(data[1].teaserlist);
    var Names = Oa.decode(data[0].teaserlist.concat(data[1].teaserlist), extra, FilterShows);
    var Name;
    for (var i=2; i<data.length; i++) {
        Name = data[i].label.trim();
        if (Names.indexOf(Name) > -1) {
            alert('Skipping Category: ' + Name);
            continue;
        }
        if (data[i].teaserlist.length)
            categoryToHtml(Name,
                           data[i].teaserlist[0].thumbnailSmall,
                           data[i].teaserlist[0].thumbnailLarge,
                           Oa.getUrl('main', extra)
                          );
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Oa.decodeSection = function(data, extra) {
    data = JSON.parse(data.responseText);
    Oa.decode(data.entries, extra);

    if (extra.cbComplete)
        extra.cbComplete();
};

Oa.decodeCategories = function (data, extra) {

    try {
        var Name;
        var Term;
        var Link;
        var ImgLink;

        switch (Oa.getCategoryIndex().current) {
        case 0:
            data = data.responseText.split('data-rt="svtoa_genre-list__link-item"').slice([1]);
            Link = 'https://origin-www.svt.se/oppet-arkiv-api/search/titles/?sort=alpha&count=1000&genreFacet=';
            var Categories = [];
            for (var i=0; i < data.length; i++) {
                ImgLink = data[i].match(/svtoa_genre-list__link-item-image" src="([^"]+)/)[1];
                Name = data[i].match(/svtoa_grenre-list__link-item-text">([^<]+)/)[1];
                Term = data[i].match(/etikett\/genre\/([^\/]+)/)[1];
                Categories.push({name:        Name,
                                 link:        Link+Term,
                                 thumb:       ImgLink,
                                 large_thumb: ImgLink.replace('small', 'large')
                                });
            }
            Categories.sort(function(a, b){return (a.name > b.name) ? 1 : -1;});
            for (var l=0; l<Categories.length; l++)
                categoryToHtml(Categories[l].name,
                               Categories[l].thumb,
                               Categories[l].large_thumb,
                               Categories[l].link
                              );
            break;
        case 1:
            data = data.responseText.split('svtoa-anchor-list-link').slice([1]);
            for (var m=0; m < data.length; m++) {
                Name = data[m].match(/etikett\/titel\/[^>]+>([^<]+)/m)[1];
                Term = data[m].match(/etikett\/titel\/([^\/]+)/m)[1];
                showToHtml(Name, null, Oa.makeShowLink(Term));
            }
            break;
        }
        data = null;
    } catch(err) {
        Log('Oa.decodeCategories Exception:' + err.message + ' data:' + JSON.stringify(data));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Oa.decodeCategoryDetail = function (data, extra) {
    data = JSON.parse(data.responseText);
    if (extra.url == Oa.getUrl('main', extra)) {
        var Label = decodeURIComponent(getIndexLocation().match(/catName=([^&]+)/)[1]);
        for (var i=0; i<data.length; i++) {
            if (data[i].label == Label) {
                data = data[i].teaserlist;
                break;
            }
        }
    } else
        data = data.entries;
    Oa.decode(data, extra, Oa.filterShows(data));
    if (extra.cbComplete)
        extra.cbComplete();
};

Oa.filterShows = function (data) {
    var Shows = [];
    var Name;
    for (var k=0; k < data.length; k++) {
        if (!data[k].tagList) continue; // Only Titles
        Name = data[k].tagList[0].term.trim();
        if (data[k].episodeNumber == 1 &&
            data[k].totalEpisodes > 1 &&
            Shows.indexOf(Name) == -1
           )
            Shows.push(Name);
    }
    return Shows;
};

Oa.decodeShowList = function(data, extra) {
    data = JSON.parse(data.responseText).entries;
    var SeasonNumbers = [];
    var Seasons = [];
    var Items = [];
    if (extra.season) {
        for (var i=0; i < data.length; i++) {
            if (data[i].seasonNumber == extra.season)
                Items.push(data[i]);
        }
    } else {
        for (var j=0; j < data.length; j++) {
            if (extra.season == 0 || !data[j].seasonNumber)
                Items.push(data[j]);
            else if (SeasonNumbers.indexOf(data[j].seasonNumber) > -1)
                continue;
            else {
                SeasonNumbers.push(data[j].seasonNumber);
                Seasons.push({season : +data[j].seasonNumber,
                              name   : 'Säsong ' + data[j].seasonNumber,
                              thumb  : data[j].thumbnailSmall,
                              link   : extra.url
                             });
            }
        }
        if (extra.season != 0 && Items.length == 0 && Seasons.length == 1)
            return callTheOnlySeason(Seasons[0].name, extra.url, extra.loc);
        else if (Seasons.length > 1) {
            Seasons.sort(function(a, b){return a.season-b.season;});
            for (var k=0; k < Seasons.length; k++)
                seasonToHtml(Seasons[k].name,
                             Seasons[k].thumb,
                             extra.url,
                             Seasons[k].season
                        );
            extra.ignore_episodes = true;
        } else {
            for (var l=0; l < Items.length; l++) {
                if (!Items[l].episodeNumber) {
                    extra.ignore_episodes = true;
                    break;
                }
            }
        }
    }
    if (!extra.ignore_episodes) {
        var Episodes = [];
        for (var m=0; m < Items.length; m++) {
            if (Items[m].episodeNumber >= 1 &&
                !Episodes[Items[m].episodeNumber]) {
                Episodes[Items[m].episodeNumber] = true;
            } else {
                extra.ignore_episodes = true;
                break;
            }
        }
    }
    if (!extra.ignore_episodes) {
        Items.sort(function(a, b) {
            return (a.episodeNumber > b.episodeNumber) ? 1 : -1;
        });
    }
    Oa.decode(Items, extra);

    if (extra.cbComplete)
        extra.cbComplete();
};

Oa.decodeSearchList = function (data, extra) {
    data = JSON.parse(data.responseText).entries;
    Oa.decode(data, extra, Oa.filterShows(data));
    if (extra.cbComplete)
        extra.cbComplete();
};

Oa.getPlayUrl = function(url, isLive) {
    var video_url, extra = {};

    requestUrl(url,
               function(status, data) {
                   data = JSON.parse(data.responseText);
                   if (Player.checkPlayUrlStillValid(url)) {
                       var subtitleReferences=[], srtUrl=null;
                       if (data.video)
                           data = data.video;

                       // Re-use SVT logic
                       Svt.sortStreams(data.videoReferences,
                                       function(s){return s.playerType;}
                                      );
                       video_url = data.videoReferences[0].url;

                       for (var k = 0; k < data.subtitles.length; k++) {
		           Log('subtitles:' + data.subtitles[k].url);
                           if (data.subtitles[k].url.indexOf('.m3u8') != -1)
                               continue;
                           else if (data.subtitles[k].url.length > 0) {
		               srtUrl = data.subtitles[k].url;
                               break;
                           }
		       }
		       Resolution.getCorrectStream(video_url, srtUrl, extra);
	           }
               }
              );
};

Oa.getNextCategory = function() {
    return getNextIndexLocation(1);
};

Oa.getCategoryIndex = function () {
    return getIndex(1);
};

Oa.getNextCategoryText = function() {
    var language = Language.checkLanguage();

    switch (Oa.getCategoryIndex().next) {
    case 0:
        // Use default
        return null;
    case 1:
        if (language == 'Swedish')
            return 'Alla Program';
        else
            return 'All Shows';
        break;
    }
};

Oa.decode = function(data, extra, FilterShows) {
    var Show;
    var Name;
    var Link;
    var LinkPrefix;
    var Description;
    var ImgLink;
    var Shows = [];
    var Links = [];
    var Names = [];
    var FilterName;

    try {

        if (!extra) extra = {};
        if (!FilterShows) FilterShows = [];
        for (var k=0; k < data.length; k++) {
            if (!data[k].contentType && data[k].facet == 'titleFacet') {
                showToHtml(data[k].name.trim(),
                           data[k].thumbnailSmall,
                           Oa.makeShowLink(data[k].term)
                          );
                continue;
            }
            Description = (data[k].summary) ? data[k].summary.trim() : null;
            Link = Oa.makeTagLink(data[k]);
            Name = data[k].title.trim();
            Names.push(Name);
            switch (data[k].contentType) {
            case 'tagTeaser':
                if (Links.indexOf(Link) > -1) {
                    alert('Skipping tagTeaser: ' + Name);
                    continue;
                }
                Links.push(Link);
                if (data[k].tagList[0].facet == 'titleFacet') {
                    LinkPrefix = makeShowLinkPrefix();
                    Description = null;
                    FilterShows.push(data[k].tagList[0].term.trim());
                    Shows.push(data[k].tagList[0].term.trim());
                } else {
                    LinkPrefix = makeCategoryLinkPrefix();
                    Link       = fixCategoryLink(Name, data[k].thumbnailLarge, Link);
                }
                toHtml({name:Name,
                        description:Description,
                        link:Link,
                        link_prefix: LinkPrefix,
                        thumb:data[k].thumbnailSmall,
                        background:data[k].thumbnailXL
                       });
                break;

            case 'video':
                Show = Oa.makeShowName(data[k]);
                FilterName = data[k].tagList[0].term.trim();
                if (Show &&
                    ((extra.query && Show.match(new RegExp(extra.query, 'i'))) ||
                     FilterShows.indexOf(FilterName) > -1)
                   ) {
                    if (Shows.indexOf(FilterName) > -1) {
                        // Already added
                        continue;
                    } else {
                        Shows.push(FilterName);
                        showToHtml(Show, data[k].thumbnailSmall, Link);
                        continue;
                    }
                }

                // Show
                if (extra.strip_show) {
                    if (!extra.ignore_episodes &&
                        data[k].episodeNumber) {
                        Name = 'Avsnitt ' + data[k].episodeNumber;
                        Description = data[k].title;
                        if (Description.match(/(del )|(avsnitt )/i) ||
                            Description == Show)
                            Description = '';
                    }
                }
                // Other
                else {
                    if (data[k].teaserTitle && 
                        !Name.match(new RegExp(data[k].teaserTitle.trim(), 'i')))
                        Name = data[k].teaserTitle.trim() + ' - ' + Name;
                    else if (Name.match(/^(avsnitt|del)/i)) {
                        if (data[k].seasonNumber > 0)
                            Name = 'Säsong ' + data[k].seasonNumber + ' - ' + Name;
                        if (Show) {
                            Description = Name;
                            Name = Show;
                        }
                    } else if (Show) {
                        if (!Name.match(new RegExp(Show, 'i')))
                            Name = Show + ' - ' + Name;
                    }
                }
                toHtml({name:Name,
                        duration:data[k].materialLength,
                        link:Oa.makeVideoLink(data[k]),
                        link_prefix: '<a href="details.html?ilink=',
                        description:Description,
                        thumb:data[k].thumbnailSmall,
                        background:data[k].thumbnailXL,
                        season:data[k].seasonNumber,
                        episode:data[k].episodeNumber,
                        show:Show
                       });
                break;

            default:
                alert('Unknown data.contentType:' + data[k].contentType);
                break;
            }
        }
    } catch(err) {
        Log('Oa.decode Exception:' + err.message + ' data[' + k + ']:' + JSON.stringify(data[k]));
    }
    return Names;
};

Oa.makeTagLink = function(data) {
    var Link = 'https://origin-www.svt.se/oppet-arkiv-api/search/tags/?';
    return Link + data.tagList[0].facet + '=' + data.tagList[0].term + '&count=1000';
};

Oa.makeVideoLink = function(data) {
    return 'https://origin-www.svt.se/oppet-arkiv-api/video/' + data.id;
};

Oa.makeShowLink = function(Term) {
    return 'https://origin-www.svt.se/oppet-arkiv-api/search/tags/?count=1000&titleFacet=' + Term;
};

Oa.makeShowName = function(data) {
    if (data.tagList && data.tagList[0].facet=='titleFacet' && data.tagList[0].name)
        return data.tagList[0].name.trim();
    else if (data.programTitle)
        return data.programTitle.trim();
    else
        return null;
};
