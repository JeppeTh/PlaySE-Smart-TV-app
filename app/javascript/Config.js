var Config = {
    data     : null,
    fileName : tizen.application.getCurrentApplication().appInfo.id + '_config.db',
    version  : 3
};

Config.init = function(Callback) {
    if (this.data) {
        // Already done
        return true;
    }
    this.data = {items:{}};
    // Save storage
    this.data.saveFile = function() {
	if (typeof JSON == 'object') {
	    // var $this = this.id;
            localStorage.setItem(Config.fileName, JSON.stringify(this.items));
            tizen.filesystem.resolve(
                'documents',
                function(dir ) {
                    try{
                        dir.createFile(Config.fileName);
                    } catch(e) {
                        // Assume it already exists...
                    }
                    dir.resolve(Config.fileName).openStream(
                        'w',
                        function(stream) {
                            stream.write(localStorage.getItem(Config.fileName));
                            stream.close();
                        });
                }
            );
        }
    };

    this.data.saveItem = function(key, value) {
	this.items[key] = value;
	this.saveFile(true);
	return this.items[key];
    };

    this.data.getItem = function(key) {
	return this.items[key];
    };

    this.data.deleteItem = function(key) {
        delete this.items[key];
	this.saveFile(true);
        return null;
    };

    this.data.deleteAll = function() {
        localStorage.setItem(Config.fileName, '{}');
        Config.initData();
    };

    this.initData = function(Callback) {
	try {
            this.data.items = localStorage.getItem(this.fileName);
            if (!this.data.items) {
                this.data.items = {};
                tizen.filesystem.resolve(
                    'documents/'+Config.fileName,
                    function(file){
                        file.readAsText(
                            function(content) {
                                if (content == '')
                                    content = '{}';
                                localStorage.setItem(Config.fileName, content);
                                Config.data.items = JSON.parse(content);
                                // Log('Found persistent config data:' + content);
                                if (Callback) Callback();
                            });},
                    function(e){
                        Log('Failed to open config file:' + e.message);
                        localStorage.setItem(Config.fileName, '{}');
                        if (Callback) Callback();
                    }
                );
            } else {
	        this.data.items = JSON.parse(this.data.items);
                // Log('Found config data:' + JSON.stringify(this.data.items));
                if (Callback) Callback();
            }
	} catch(err) {
            Log('Failed to read config:' + err);
	}
    };

    this.upgrade = function() {
        var old_version = this.read('version');
        if (!old_version || old_version < this.version) {
            Log('Upgrade from version:' + old_version);
            if (!old_version || old_version == 1) {
                var cookies = ['language','res','liveres','subEnabled','subSize','subPos','subHeight','subBack'];
                if (old_version == 1)
                    // A mistake was done in version 1
                    cookies = ['res','liveres'];
                for (var i=0; i < cookies.length; i++)
                    cookieToConfig(cookies[i]);
                deleteAllCookies();
            }
            if (!old_version || old_version < 3) {
                var liveres = Config.read('liveres');
                if (liveres != null)
                    Config.save('liveres', +liveres+1);
                if (+Config.read('liveres') == 5)
                    Config.save('liveres', 6);
                if (+Config.read('res') == 5)
                    Config.save('res', 6);
            }
        } else if (old_version == this.version) {
            Log('Same version ' + old_version);
        } else if (old_version > this.version) {
            Log('Downgrade from ' + old_version);
            this.data.deleteAll();
        }
        this.save('version', this.version);
    };

    this.test = function() {
        try {
            if (!this.read('version')) {
                throw 'Configuration not supported';
            }
	} catch(err) {
            Log('Failed to test config:' + err);
            throw 'Configuration test failed';
	}
    };
    this.initData(function() {
        Config.upgrade();
        Config.test();
        Callback();
    });
    return false;
};

Config.read = function(key) {
    if (this.data.getItem(key))
        return JSON.parse(this.data.getItem(key));
    return null;
};

Config.save = function(key, value) {
    return this.data.saveItem(key, JSON.stringify(value));
};

Config.remove = function(key) {
    return this.data.deleteItem(key);
};

function cookieToConfig(name) {
    var value = getCookie(name);
    if (value) {
        Config.save(name, value);
        // Log('Cookie for ' + name + ' moved:' + Config.read(name));
    }
}
