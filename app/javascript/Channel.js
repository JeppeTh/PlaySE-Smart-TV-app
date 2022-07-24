var Channel = {
    main_impl : null,
    main_ch_id : null,
    impl : null,
    ch_id : null
};

Channel.init = function() {
    if (!Channel.impl) {
        Channel.set(Svt, 'svt');
    }
};

Channel.id = function() {
    return this.ch_id;
};

Channel.set = function(newChannel, newId) {
    if (this.main_ch_id != newId || 
        this.main_ch_id != this.ch_id ||
        Channel.isSubChannelSet()) {
        Channel.setTmp(newChannel, newId, true);
        this.main_impl = this.impl;
        this.main_ch_id = this.ch_id;
        Channel.resetSubChannel();
        return true;
    } else {
        return false;
    }
};

Channel.setTmp = function(newChannel, newId, lib) {
    if (!lib)
        Log('Channel.setTmp: ' + newId);
    this.impl  = newChannel;
    this.ch_id = newId;
};

Channel.clearTmp = function() {
    // Log('Channel.clearTmp')
    this.impl  = this.main_impl;
    this.ch_id = this.main_ch_id;
};

Channel.setCheckedChannelText = function(button) {
    if (this.main_impl.getCheckedChannelText)
        button.find('a').text(this.impl.getCheckedChannelText());
};

Channel.setUnCheckedChannelText = function(button) {
    if (this.main_impl.getCheckedChannelText)
        button.find('a').text(this.impl.getUnCheckedChannelText());
};

Channel.isSubChannelSet = function() {
    if (this.impl.isSubChannelSet)
        return this.impl.isSubChannelSet();
    return false;
};

Channel.resetSubChannel = function() {
    if (this.impl.resetSubChannel)
        this.impl.resetSubChannel();
};

Channel.savePosition = function(pos) {
    if (this.main_impl.savePosition)
        return this.main_impl.savePosition(pos);
    else
        return pos;
};

Channel.checkPosition = function(pos) {
    if (this.main_impl.checkPosition)
        return this.main_impl.checkPosition(pos);
    return pos;
};

Channel.savePosition = function(pos) {
    if (this.main_impl.savePosition)
        return this.main_impl.savePosition(pos);
    else
        return pos;
};

Channel.checkResume = function(location) {
    if (this.main_impl.checkResume)
        return this.main_impl.checkResume(location);
    return false;
};

Channel.markResumed = function() {
    if (this.main_impl.markResumed)
        return this.main_impl.markResumed();
    return false;
};

Channel.updateResumed = function(percentage) {
    if (this.main_impl.updateResumed)
        return this.main_impl.updateResumed(percentage);
    return false;
};

Channel.getName = function() {
    return this.getHeaderPrefix(true).toLowerCase();
};

Channel.getHeaderPrefix = function(MainName) {
    return this.main_impl.getHeaderPrefix(MainName);
};

Channel.getHeaders = function() {
    if (this.impl.getHeaders)
        return this.impl.getHeaders();
    else
        return null;
};

Channel.getStartPage = function() {
    if (this.main_impl.getStartPage)
        return this.main_impl.getStartPage();
    else
        return 'index.html';
};

Channel.getUrl = function(tag, extra) {
    return this.impl.getUrl(tag, extra);
};

Channel.exists = function(channelId) {
    return eval($('.channel-content').find('#'+channelId).attr('channel'));
};

Channel.upgradeUrl = function(channelId, url) {
    channelId = eval($('.channel-content').find('#'+channelId).attr('channel'));
    if (channelId.upgradeUrl && url) {
        var NewUrl = channelId.upgradeUrl(url);
        if (NewUrl != url)
            Log('Url Upgraded: ' + url + ' -> ' + NewUrl);
        return NewUrl;
    }
    return url;
};

Channel.redirectUrl = function(url, callback) {
    if (this.impl && this.impl.redirectUrl && getUrlParam(url,'my_redirect')) {
        this.impl.redirectUrl(url.replace(/[&?]my_redirect.+/,''), callback);
        return true;
    }
    return false;
};

Channel.redirectMpd = function(url) {
    var flags = url.match(/(\|.+)/)[0];
    return this.impl.redirectMpd(url.replace(/\|.+/,'')) + flags;
};

Channel.login = function(callback) {
    if (this.impl.login)
        this.impl.login(callback);
    else if (callback)
        callback();
};

Channel.isLoggedIn = function() {
    if (this.impl.isLoggedIn)
        return this.impl.isLoggedIn();
    else
        return true;
};

Channel.decodeMain = function(data, extra) {
    this.impl.decodeMain(data, extra);
};

Channel.decodeSection = function(data, extra) {
    this.impl.decodeSection(data, extra);
};

Channel.decodeCategories = function(data, extra) {
    this.impl.decodeCategories(data, extra);
};

Channel.decodeCategoryDetail = function(data, extra) {
    this.impl.decodeCategoryDetail(data, extra);
};

Channel.decodeLive = function(data, extra) {
    this.impl.decodeLive(data, extra);
};

Channel.decodeShowList = function(data, extra) {
    this.impl.decodeShowList(data, extra);
};

Channel.decodeSearchList = function(data, extra) {
    this.impl.decodeSearchList(data, extra);
};

Channel.getDetailsUrl = function(name) {
    return this.impl.getDetailsUrl(name);
};

Channel.getDetailsData = function(url, data) {
    return this.impl.getDetailsData(url, data);
};

Channel.getPlayUrl = function(url, isLive) {
    this.impl.getPlayUrl(url, isLive);
};

Channel.refreshPlayUrl = function(cbComplete) {
    if (this.impl.refreshPlayUrl)
        this.impl.refreshPlayUrl(cbComplete);
    else
        cbComplete();
};

Channel.tryAltPlayUrl = function(failedUrl, cbComplete) {
    if (this.impl.tryAltPlayUrl) {
        Log('tryAltPlayUrl');
        return this.impl.tryAltPlayUrl(failedUrl, cbComplete);
    }
    return false;
};

Channel.fetchSubtitles = function(srtUrl, hlsSubs, usedRequestedUrl, cb) {
    Subtitles.init();
    if (typeof srtUrl == 'string' && srtUrl.match(/\.m3u8/)) {
        hlsSubs = [srtUrl];
        srtUrl = null;
    }
    if (srtUrl && srtUrl != '') {
        if (this.impl.fetchSubtitles)
            this.impl.fetchSubtitles(srtUrl, hlsSubs, usedRequestedUrl, {cb:cb});
        else
            Subtitles.fetch(srtUrl, hlsSubs, usedRequestedUrl, {cb:cb});
    } else if (hlsSubs)
        Subtitles.fetchHls(hlsSubs, usedRequestedUrl, {cb:cb});
    else
        cb();
};

Channel.keyRed = function() {
    if (Channel.isLoggedIn()) {
        if (this.main_impl.keyRed)
            this.main_impl.keyRed();
        else
            setLocation(Channel.getStartPage());
    }
};

Channel.keyGreen = function() {
    if (Channel.isLoggedIn()) {
        if (this.main_impl.keyGreen)
            this.main_impl.keyGreen();
        else
            setLocation('categories.html');
    }
};

Channel.keyYellow = function() {
    if (Channel.isLoggedIn()) {
        if (this.main_impl.keyYellow)
            this.main_impl.keyYellow();
        else
            setLocation('live.html');
    }
};

Channel.keyBlue = function() {
    if (Channel.isLoggedIn()) {
        if (this.main_impl.keyBlue)
            this.main_impl.keyBlue();
        else {
            Language.hide();
            Search.imeShow();
        }
    }
};

Channel.getMainTitle = function() {
    if (this.main_impl.getMainTitle)
        return this.main_impl.getMainTitle();
    else
        return 'Populärt';
};

Channel.getSectionTitle = function(location) {
    if (this.impl.getSectionTitle)
        return this.impl.getSectionTitle(location);
    else
        return document.title;
};

Channel.getCategoryTitle = function() {
    if (this.impl.getCategoryTitle)
        return this.impl.getCategoryTitle();
    else
        return 'Kategorier';
};

// TODO  - is very similar to button text - re-use?
Channel.getLiveTitle = function() {
    if (this.impl.getLiveTitle)
        return this.impl.getLiveTitle();
    else
        return 'Kanaler & livesändningar';
};

Channel.getVariantName = function(variant) {
    return this.impl.getVariantName(variant);
};

Channel.getAButtonText = function(language) {
    var text = null;

    if (this.main_impl.getAButtonText)
        text =  this.main_impl.getAButtonText(language);

    if (text == null) {
        if(language == 'English'){
	    return 'Popular';
        } else {
	    return 'Populärt';
        }
    }
    return text;
};

Channel.getBButtonText = function(language) {
    var text = null;
    if (this.main_impl.getBButtonText)
        text = this.main_impl.getBButtonText(language);

    if (text === null) {
        if(language == 'English')
            return 'Categories';
        else
            return 'Kategorier';
    } else if (text === 0)
        // keep text
        return $('#b-button').text();
    return text;
};

Channel.getCButtonText = function(language) {
    if (this.main_impl.getCButtonText)
        return this.main_impl.getCButtonText(language);

    if(language == 'English')
	return 'Channels & live broadcasts';
    else
        return 'Kanaler & livesändningar';
};

Channel.getDButtonText = function(language) {
    if (this.main_impl.getDButtonText)
        return this.main_impl.getDButtonText(language);

    if(language == 'English')
	return 'Search';
    else
        return 'Sök';
};
