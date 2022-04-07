var History = {
    resume_index: null
};

History.savePosition = function(pos) {
    var tmp_channel = itemSelected && itemSelected.find('.ilink').attr('href').match(/tmp_channel_id=([^&]+)/);
    if (tmp_channel) {
        pos.name       = itemSelected.text();
        pos.channel_id = tmp_channel[1];
        alert('savePosition:' + JSON.stringify(pos));
    }
    return pos;
};

History.checkPosition = function(pos) {
    if (pos.name) {
        if (itemSelected.text() != pos.name ||
            !itemSelected.find('.ilink').attr('href').match('tmp_channel_id=' + pos.channel_id)) {
            if (htmlSection) {
                htmlSection = getInitialSection();
                loadSection();
            }
            return {col:0, top:true, section:htmlSection};
        }
    }
    return pos;
};

History.checkResume = function(location) {
    var show = location.match(/[?&]show_name=([^&]+)/);
    if (show) {
        show = decodeURIComponent(show[1]);
        var meta = History.lookup(show);
        if (!location.match(/[?&]season=/) && meta.season)
            return History.findSeason(show, meta);
        else if (!location.match(/[?&]variant=/) && meta.variant)
            return History.findVariant(show, meta);
        else if (!location.match(/[?&]clips=/) && meta.season)
            return History.findClips(show, meta);
        else
            return History.findEpisode(show, meta);
    } else {
        History.markResumed(true);
    }
    return false;
};

History.markResumed = function(select) {
    var showRegexp = new RegExp('^' + History.getMainTitle() + '\/([^/]+)/');
    show = document.title.match(showRegexp);
    if (show) {
        show = decodeURIComponent(show[1]);
        var meta = History.lookup(show);
        var combinedString = '^' + History.getMainTitle() + '\/' + show + '\/';
        if (meta && meta.season) {
            combinedString += '(S[^s]+song? )?' + decodeURIComponent(meta.season) + '/';
        }
        if (meta && meta.variant) {
            combinedString += Channel.getVariantName(meta.variant) + '/';
        }
        if (myRefreshLocation)
            combinedString += '[^/]+\/';
        var combinedRegexp = new RegExp(combinedString + '$','i');
        if (decodeURIComponent(document.title).match(combinedRegexp))
            return History.findEpisode(show, meta, !select);
    }
    return false;
};

History.updateResumed = function(percentage) {
    if (items.length)
        // Items are available and must be updated - i.e. same as mark
        History.markResumed();
    else
        updateResumed(percentage);
};

History.findSeason = function(show, meta) {
    alert('Resume Season ' + meta.season);
    if (History.findLinkPrefix(show, "season", new RegExp('^(S[^s]+song? )?' + meta.season + '$','i')))
        return true;
    else
        return History.findVariant(show, meta);
};

History.findVariant = function(show, meta) {
    alert('Resume Variant ' + meta.variant + ' season:' + meta.season);
    if (History.findLinkPrefix(show, "variant", new RegExp('^' + meta.variant + '$','i')))
        return true;
    else
        return History.findClips(show, meta)
};

History.findClips = function(show, meta) {
    alert('Resume Clips season:' + meta.season);
    if (History.findLinkPrefix(show, "title", new RegExp('^' + meta.season + '$','i')))
        return true;
    else
        return History.findEpisode(show, meta);
};

History.findLinkPrefix = function(show, variable, regexp) {

    for (var i=0; i < items.length; i++) {
        var value = getUrlParam(items[i].link_prefix, variable);
        if (value && value.match(regexp)) {
            var link = itemToLink(items[i], 'show_name=' + encodeURIComponent(show)) + '"/>';
            window.setTimeout(function() {
                selectItemIndex(i);
                setLocation($(link).attr('href'));
                alert('Resumed ' + regexp);
            }, 0);
            return true;
        }
    }
    return false;
};

History.getNumber = function(thing) {
    if  (typeof(thing) === 'string') {
        var number = thing.replace(/[^0-9]+/g,'');
        if (number == '') return -1;
        return +number;
    }
    return thing;
};

History.match = function(a, b) {

    if (a != b) {
        var number = History.getNumber(a);
        return (number >= 0 && number == History.getNumber(b));
    } else
        return true;
};

History.findEpisode = function(show, meta, noSelect) {
    alert('Resume Episode:' + meta.episode + ' season:' + meta.season + ' name:' + meta.episode_name);
    var hits = [];
    for (var i=0; meta.episode && i < items.length; i++) {
        if (!items[i].is_upcoming &&
            (!meta.season || History.match(meta.season,items[i].season)) &&
            History.match(meta.episode, items[i].episode)) {
            hits.push(i);
        }
    }
    if (hits.length > 1) {
        var name_hits = [];
        for (var j=0; meta.episode_name && j < hits.length; j++) {
            if (items[hits[j]].name == meta.episode_name)
                name_hits.push(hits[j]);
        }
        hits = name_hits;
    }
    else if (hits.length == 0) {
        for (var k=0; meta.episode_name && k < items.length; k++) {
            if (items[k].name == meta.episode_name)
                hits.push(k);
        }
    }
    if (hits.length == 1) {
        // First remove possibly old resumed
        for (var l=0; l < items.length; l++) {
            if (items[l].watched) {
                items[l].watched = null;
                removeResumed(l);
                break;
            }
        }
        var percentage = History.fixResumePercentage(meta.watched);
        items[hits[0]].watched = percentage;
        if (!noSelect) {
            selectItemIndex(hits[0]);
            myPos = Channel.savePosition({col     : columnCounter,
                                          top     : isTopRowSelected,
                                          section : htmlSection
                                         });
        }
        addResumed(hits[0], percentage);
        alert('Resumed episode ' + meta.episode);
    }
    return false;
};

History.fixResumePercentage = function(percentage) {
    if (!percentage || percentage < 3)
        percentage = 3;
    if (percentage > 96)
        percentage = 100;
    return percentage;
};

History.getHeaderPrefix = function(MainName) {
    return '';
};

History.getStartPage = function() {
    return 'index.html?tmp_channel_clr=1&pos_by_item=1';
};

History.getUrl = function(tag, extra) {
    return History.getStartPage();
};

History.decodeMain = function(data, extra) {
    var LinkPrefix;
    var UrlParams;
    var Names = [];
    var Shows = Config.read('History');
    var NewShows;

    // Filter possibly removed channels
    Shows = Shows.filter(function(Show)
                         {
                             return Channel.exists(Show.channel_id);
                         });
    // Check for duplicate names and upgrade urls
    for (var i=0; Shows && i < Shows.length; i++) {
        Shows[i].url = Channel.upgradeUrl(Shows[i].channel_id, Shows[i].url);
        Shows[i].thumb = Channel.upgradeUrl(Shows[i].channel_id,Shows[i].thumb);
        Shows[i].large_thumb = Channel.upgradeUrl(Shows[i].channel_id,Shows[i].large_thumb);
        if (Names[Shows[i].name])
            Names[Shows[i].name] += 1;
        else
            Names[Shows[i].name] = 1;
    }
    // Save again in case of upgraded links
    Config.save('History', Shows);

    for (var j=0; Shows && j < Shows.length; j++) {
        UrlParams = 'show_name=' + encodeURIComponent(Shows[j].name) +
            '&tmp_channel_id=' + Shows[j].channel_id;
        if (Names[Shows[j].name] > 1)
            // Add Channel to duplicates
            Shows[j].name += ' (' + $('.channel-content').find('#'+Shows[j].channel_id).text() + ')';
        if (Shows[j].is_category)
            categoryToHtml(Shows[j].name,
                           Shows[j].thumb,
                           Shows[j].large_thumb,
                           Shows[j].url,
                           UrlParams
                          );
        else
            showToHtml(Shows[j].name,
                       Shows[j].thumb,
                       Shows[j].url,
                       makeShowLinkPrefix(UrlParams)
                      );
    }
    if (History.resume_index) {
        if (History.resume_index >= Shows.length)
            History.resume_index = Shows.length-1;
        selectItemIndex(History.resume_index);
        myPos = {col     : columnCounter,
                 top     : isTopRowSelected,
                 section : htmlSection
                };
        History.resume_index = null;
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

History.keyRed = function() {
    return;
};

History.keyGreen = function() {
    return;
};

History.keyYellow = function() {
    return;
};

History.keyBlue = function() {
    var showName = myLocation.match(/[?&]show_name=([^&]+)/);
    if (!showName && detailsOnTop)
        showName = getOldLocation().match(/[?&]show_name=([^&]+)/);
    var channelId = Channel.id();
    if (!showName && itemSelected) {
        showName = itemSelected.find('.ilink').attr('href').match(/[?&]show_name=([^&]+)/);
        channelId = itemSelected.find('.ilink').attr('href').match(/tmp_channel_id=([^&]+)/);
        if (channelId)
            channelId = channelId[1];
    }
    if (showName) {
        var index = History.removeShow(decodeURIComponent(showName[1]), channelId);
        if (myLocation.match(/index\.html/))
            History.resume_index = index;
        initChannel();
    }
};

History.getMainTitle = function() {
    return 'Historik';
};

History.getAButtonText = function(language) {
    return '';
};

History.getBButtonText = function(language) {
    return '';
};

History.getCButtonText = function(language) {
    return '';
};

History.getDButtonText = function(language) {
    if(language == 'English')
	return 'Remove';
    else
        return 'Ta bort';
};

History.addShow = function(details, percentage) {
    if (!details || details.is_live || details.is_channel || !details.parent_show)
        return;


    // Keep old percentage in case none provided. At least consistent behaviour with how
    // resume info is handled in player.
    if (!percentage) {
        var oldEntry = History.lookup(details.parent_show.name);
        if (oldEntry && History.isSameEpisode(oldEntry,details))
            percentage = oldEntry.watched;
    }

    var savedShows = History.removeShow(details.parent_show.name, Channel.id(), true);
    if (!savedShows)
        savedShows = [];
    savedShows.unshift({channel_id   : Channel.id(),
                        name         : details.parent_show.name,
                        thumb        : details.parent_show.thumb,
                        large_thumb  : details.parent_show.large_thumb,
                        url          : details.parent_show.url,
                        season       : details.season,
                        variant      : details.variant,
                        episode      : details.episode,
                        episode_name : details.episode_name,
                        is_category  : details.parent_show.is_category,
                        watched      : percentage
                       });
    Config.save('History', savedShows.slice(0,30));
    Channel.updateResumed(History.fixResumePercentage(percentage));
};

History.removeShow = function(showName, channelId, noSave) {

    var savedShows = Config.read('History');
    var i;
    if (savedShows) {
        for (i=0; i < savedShows.length; i++) {
            if (savedShows[i].channel_id == channelId &&
                savedShows[i].name == showName) {
                savedShows.splice(i, 1);
                break;
            }
        }
    }
    if (noSave)
        return savedShows;
    else
        Config.save('History', savedShows);
    return i;
};

History.lookup = function(showName) {

    var savedShows = Config.read('History');
    if (savedShows) {
        for (var i=0; i < savedShows.length; i++) {
            if (savedShows[i].channel_id == Channel.id() &&
                savedShows[i].name == showName)
                return savedShows[i];
        }
    }
    return null;
};

History.isSameEpisode = function(a, b) {
    return a.season==b.season && a.episode==b.episode && a.episode_name==b.episode_name;
};
