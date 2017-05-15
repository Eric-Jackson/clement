/*! Original code by Matslom https://github.com/Matslom/mybb-theme-editor
Modified by Eric Jackson http://digitalrelativity.com */

'use strict';

const config   = require('./config.json'),
      watch    = require('watch'),
      mysql    = require('mysql'),
      del      = require('del'),
      glob     = require("glob"),
      mkdirp   = require("mkdirp"),
      path     = require('path'),
      fs       = require('fs'),
      xml2js   = require('xml2js');

module.exports = {

    connection: mysql.createConnection(config.mysql),
    queries: {
        allTemplates: 'SELECT title, template, sid FROM ' + config.database.prefix + 'templates WHERE sid='+ config.templates.id + ' OR sid=-2',
        updateTemplates: function(data, title) {
            return 'UPDATE ' + config.database.prefix + 'templates SET template=\'' + data + '\' WHERE sid=' + config.templates.id + ' AND title=\'' + title + '\'';
        }
    },

    init: function() {
        const _this = this;
        
        _this.connection.connect();

        let createMainDirectory = new Promise((resolve, reject) => {
            resolve(_this.createDirectory(config.app.datadir));
        });

        createMainDirectory
            .then(console.log("Main directory created"))
            .then(_this.toFile())
            .then(console.log("Things are filed"))
            .then(_this.connection.end())
            .then(console.log("Everything is finished"))
            .catch(() => console.log("Promise Rejected") );
    },

    createDirectory: function(directory) {
        return new Promise((resolve, reject) => {
            mkdirp(directory, error => {
                if (error) {
                    console.error(error);
                    return reject();
                } else {
                    console.log(config.app.datadir + ' directory created.');
                    return resolve();
                }
            });
        });
    },

    toFile: function() {
        const _this = this;

        return new Promise((resolve, reject) => {
            _this.connection.query(_this.queries.allTemplates, function(err, rows, fields) {
                if (err) {
                    reject();
                } 
                for (let i = 0; i < rows.length; i++) {
                    _this.createTemplate(rows[i]);
                }
                resolve();
            });
        });
    },

    createTemplate: function(row) {
        const _this = this;

        let title = row.title,
            name = title.split('_'),
            dir;

        if (_this.inArray(title, config.templates.ungrouped)) {
            dir = config.app.datadir +'/ungrouped';
        } else {
            dir = config.app.datadir +'/'+ name.shift();
        }

        let createDirectory = new Promise((resolve, reject) => {
            mkdirp(dir, error => {
                if (error) {
                    console.error(error);
                    return reject();
                } else {
                    console.log(dir + ' directory created.');
                    return resolve();
                }
            });
        });

        createDirectory
            .then(_this.createFile(dir +'/'+ title + config.app.fileext, row.template))
            .catch(() => console.log("Promise Rejected"));
    },

    inArray: (string, array) => array.indexOf(string) !== -1,

    createFile: function(filename, dbTemplate) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filename, dbTemplate, err => {
                if(err) {
                    return Promise.reject();
                }
                console.log("Template " + filename + " created.");
                return Promise.resolve();
            });
        });
    },

    toDb: function() {
        const _this = this;

        _this.connection.connect();
        let saveFiles = new Promise(function(resolve, reject) {
            glob(config.app.datadir + '/**/*' + config.app.fileext, function(err, files) {
                if (err) {
                    console.log(err);
                    reject();
                } 
                for (let i = 0; i < files.length; i++) {
                    _this.saveTemplate(files[i]);
                    console.log(files[i] + ' was saved to the database.');
                }
            });
        });
        
        saveFiles.then(function() {
            _this.connection.end();
        })
        
        .catch(function () {
            console.log("Promise Rejected");
        });
    },

    saveTemplate: function(fullpath) {
        const _this = this;
        let filename = path.basename(fullpath, config.app.fileext);

        return new Promise((resolve, reject) => {
            fs.readFile(fullpath, 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                    return reject();
                }
                let cleanData = _this.addSlashes(data);
                _this.connection.query(_this.queries.updateTemplates(cleanData, filename), (err, result) => {
                    if (err) {
                        console.log(err);
                        return reject();
                    }

                    return resolve();
                });
            });
        });
    },

    watch: function() {
        const _this = this;
        _this.connection.connect();
    
        watch.createMonitor(config.app.datadir, function(monitor) {
            monitor.files = config.app.datadir + '/**/*' + config.app.fileext;
            console.log('Watching ' + config.app.datadir);
            monitor.on("changed", function(f, curr, prev)  {
                _this.saveTemplate(f);
            });
        });
    },

    delete: () => {
        del([config.app.datadir +'/*']);
        console.log('All data deleted');
    },

    addSlashes: string => {
        return string.replace(/\\/g, '\\\\')
                     .replace(/\u0008/g, '\\b')
                     .replace(/\t/g, '\\t')
                     .replace(/\n/g, '\\n')
                     .replace(/\f/g, '\\f')
                     .replace(/\r/g, '\\r')
                     .replace(/'/g, '\\\'')
                     .replace(/"/g, '\\"');
    }
};

// // TODO: Make this work
// loadThemeFile() {
//     let parser = new xml2js.Parser();
//     fs.readFile(__dirname + '/foo.xml', function(err, data) {
//         parser.parseString(data, function (err, result) {
//             console.dir(result);
//             console.log('Done');
//         });
//     });
// }
