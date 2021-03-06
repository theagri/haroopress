var fs = require('fs'),
    conf = require('../../config'),
    path = require('path'),
    crypto = require('crypto'),
    direc = require('direc'),
    findit = require('findit'),
    md = require('robotskirt');

function Haroo() {
    var archiveFiles = direc.sort(conf.sourceDir +'/articles', 'mtime'),
        authorFiles = direc.sort(conf.sourceDir +'/authors'),
        pageFiles = findit.sync(conf.sourceDir +'/pages'),
        authors = {},
        archives = {},
        categories = {},
        pages = {},
        tags = {},
        favorites = {}; 

    function tokenizer(str) {
        var token = str.split('\n\n'),
            head = JSON.parse(token.shift()),
            body = token.join('\n\n');

        return {
            head: head,
            body: body
        }
    }

    function categorize(archive, cates) {
        cates.forEach(function(cate) {
            if(!categories.hasOwnProperty(cate)) {
                categories[cate] = [];
                categories[cate].push(archive);
            } else {
                categories[cate].push(archive);
            }
        });
    }

    function authorize(archive, author) {
        authors[author].archives.push(archive);
    }

    function tagize(archive, taglist) {
        taglist.forEach(function(tag) {
            if(!tags.hasOwnProperty(tag)) {
                tags[tag] = [];
                tags[tag].push(archive);
            } else {
                tags[tag].push(archive);
            }
        });
    }
    
    /**
     * @desc gravatar image url
     * @return String
     */
    function getGravatar(email, size) {
        var size = size || '128',
            md5 = crypto.createHash('md5');
            md5.update(email);

        return "http://www.gravatar.com/avatar/"+ md5.digest('hex') +"?r=pg&s="+ size +".jpg&d=identicon";
    }

    /**
     * @desc load archive & 
     * @param String file
     * @return Object
     */
    function loadArticle(file) {
        var text = fs.readFileSync(file, 'utf8');

        return tokenizer(text);
    }

    /**
     * @desc load pages
     * 
     */
     function loadPage(file) {
         var text = fs.readFileSync(file, 'utf8');

         return tokenizer(text);
     }

    /**
     * @desc load author
     * @param String file
     * @return Object
     */
    function loadAuthor(file) {
        var text = fs.readFileSync(file, 'utf8');

        return tokenizer(text);
    }

    function loadFavorite() {
        var links = fs.readFileSync(conf.sourceDir +'/favorites.markdown', 'utf8');
        var token;

        favorites.list = [];
        links = links.split('\n');

        links.forEach(function(link) {
            if(link) {
                token = {};

                link = link.match( /^\[([\s\S]*?)\][ \t]*\([ \t]*(\S+)(?:[ \t]+(["'])(.*?)\3)?[ \t]*\)/ );
                token.name = link[1];
                token.url = link[2];

                favorites.list.push(token);
            }
        });
    }

    function getFileName(file) {
        file = file.split('/');                                                                                                       
        file = file[file.length - 1].replace('.markdown', '');

        return file;
    }

    function getTOC(text) {
        var tokens = text.split('\n');
        var i, m, len = tokens.length, line, level;
        var toc = {};

        for(i = 0; i < len; i++) {
            line = tokens[i];
            m = line.match( /^(#{1,6})\s*(.*?)\s*#*\s*(?:\n|$)/ );

            //header 가 아닌 경우
            if ( !m ) {
                continue;
            }
            
            level = m[1].length;

            //toc 에 level 속성이 없는 경우
            if (!toc.hasOwnProperty(level)) {
               toc[level] = []; 
            }

            toc[level].push(line.replace(/#/g, '').trim());
        }

        return toc;
    }
    
    function initialize() {
        var file, author;
        authorFiles.forEach(function(item) {
            file = item._file;
            author = loadAuthor(file);
            author._gravatar = getGravatar(author.head.email);
            author.body = md.toHtmlSync(author.body);
            author.archives = [];
            authors[author.head.name] = author;
        });

        var archive, id;
        archiveFiles.forEach(function(item) {
            id = getFileName(item._file);

            archive = archives[id] = loadArticle(item._file);
            archive.html = md.toHtmlSync(archive.body);
            //TODO: short cut html for index page

            archive._file = id;
            archive.author = authors[archive.head.author];

            categorize(archive, archive.head.categories);
            tagize(file, archive.head.tags);
            authorize(archive, archive.head.author);
        });

        var page, stat, dir, file;
        pageFiles.forEach(function(item) {
            stat = fs.statSync(item);

            if (stat.isFile() && item.indexOf('.markdown') >= 0) {
                page = loadPage(item);
                page._file = item;
                page.html = md.toHtmlSync(page.body);
              
                dir = item.split('/');
                file = dir.pop();
                page._dir = dir.join('/');

                page._path = item.replace(conf.sourceDir +'/pages', '');

                page._path = item.replace(conf.sourceDir +'/pages', '');
                page._path = page._path.replace('.markdown', '.html');
                page._path = page._path.replace('index.html', '');

                page.toc = getTOC(page.body);
                pages[page._path] = page;

            }
        });

        loadFavorite();        
    }

    initialize();
    
    return {
        getMainData: function() {
            return {
                archives: archives,
                categories: categories,
                authors: authors,
                pages: pages,
                favorites: favorites,
                config: conf
            }
        },
        /**
         * @return Array
         */
        getArchives: function() {
            return archives;
        },

        getArchiveHeader: function(id) {
            return archives[id].head;
        },

        getArchiveMarkdown: function(id) {
            return archives[id].body;
        },

        getArchiveBody: function(id) {
            return md.toHtmlSync(archives[id].body);
        },

        getArchiveCutBody: function(id, cut) {
            var archive = archives[id].body.split('\n\n');
            cut = cut || 5;
            archive = archive.slice(0, cut);
            archive = archive.join('\n\n');

            return md.toHtmlSync(archive);
        },

        getAuthorIntro: function(id) {
            return md.toHtmlSync(authors[id].body);
        }
    };
};

module.exports = new Haroo();
