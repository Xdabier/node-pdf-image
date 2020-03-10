"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("path");
var fs_1 = require("fs");
var util_1 = require("util");
var child_process_1 = require("child_process");
var PDFImage = /** @class */ (function () {
    function PDFImage(_pdfFilePath, options) {
        if (options === void 0) { options = {}; }
        this._convertOptions = {};
        this._pdfFilePath = _pdfFilePath;
        this._useGM = options.graphicsMagick || false;
        this._combinedImage = options.combinedImage || false;
        this._outputDirectory = options.outputDirectory || path_1.dirname(_pdfFilePath);
        this._setPdfFileBaseName(options.pdfFileBaseName ? options.pdfFileBaseName : undefined);
        this._setConvertOptions(options.convertOptions ? options.convertOptions : undefined);
        this._setConvertExtension(options.convertExtension ? options.convertExtension : undefined);
    }
    PDFImage.prototype._setPdfFileBaseName = function (pdfFileBaseName) {
        this._pdfFileBaseName = pdfFileBaseName || path_1.basename(this._pdfFilePath, ".pdf");
    };
    PDFImage.prototype._setConvertOptions = function (convertOptions) {
        this._convertOptions = convertOptions || {};
    };
    PDFImage.prototype._setConvertExtension = function (convertExtension) {
        this._convertExtension = convertExtension || "png";
    };
    PDFImage.prototype.constructGetInfoCommand = function () {
        return util_1.format("pdfinfo \"%s\"", this._pdfFilePath);
    };
    PDFImage.prototype.parseGetInfoCommandOutput = function (output) {
        var info = {};
        output.split("\n").forEach(function (line) {
            if (line.match(/^(.*?):[ \t]*(.*)$/)) {
                info[RegExp.$1] = RegExp.$2;
            }
        });
        return info;
    };
    PDFImage.prototype.getInfo = function () {
        var getInfoCommand = this.constructGetInfoCommand();
        var THIS = this;
        return new Promise(function (resolve, reject) {
            child_process_1.exec(getInfoCommand, function (err, stdout, stderr) {
                if (err) {
                    return reject({
                        message: "Failed to get PDF'S information",
                        error: err,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
                return resolve(THIS.parseGetInfoCommandOutput(stdout));
            });
        });
    };
    PDFImage.prototype.numberOfPages = function () {
        return this.getInfo().then(function (info) {
            return info["Pages"];
        });
    };
    PDFImage.prototype.getOutputImagePathForPage = function (pageNumber) {
        return path_1.join(this._outputDirectory, this._pdfFileBaseName + "-" + pageNumber + "." + this._convertExtension);
    };
    PDFImage.prototype.getOutputImagePathForFile = function () {
        return path_1.join(this._outputDirectory, this._pdfFileBaseName + "." + this._convertExtension);
    };
    PDFImage.prototype.constructConvertCommandForPage = function (pageNumber) {
        var pdfFilePath = this._pdfFilePath;
        var outputImagePath = this.getOutputImagePathForPage(pageNumber);
        var convertOptionsString = this.constructConvertOptions();
        return util_1.format("%s %s\"%s[%d]\" \"%s\"", this._useGM ? "gm convert" : "convert", convertOptionsString ? convertOptionsString + " " : "", pdfFilePath, pageNumber, outputImagePath);
    };
    PDFImage.prototype.constructCombineCommandForFile = function (imagePaths) {
        return util_1.format("%s -append %s \"%s\"", this._useGM ? "gm convert" : "convert", imagePaths.join(' '), this.getOutputImagePathForFile());
    };
    PDFImage.prototype.constructConvertOptions = function () {
        var _this = this;
        return Object.keys(this._convertOptions).sort().map(function (optionName) {
            // @ts-ignore
            if (_this._convertOptions[optionName] !== null) {
                // @ts-ignore
                return optionName + " " + _this._convertOptions[optionName];
            }
            else {
                return optionName;
            }
        }, this).join(" ");
    };
    PDFImage.prototype.combineImages = function (imagePaths) {
        var THIS = this;
        var combineCommand = THIS.constructCombineCommandForFile(imagePaths);
        return new Promise(function (resolve, reject) {
            child_process_1.exec(combineCommand, function (err, stdout, stderr) {
                if (err) {
                    return reject({
                        message: "Failed to combine images",
                        error: err,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
                child_process_1.exec("rm " + imagePaths.join(' ')); //cleanUp
                return resolve(THIS.getOutputImagePathForFile());
            });
        });
    };
    PDFImage.prototype.convertFile = function () {
        var THIS = this;
        return new Promise(function (resolve, reject) {
            THIS.numberOfPages().then(function (totalPages) {
                var convertPromise = new Promise(function (resolve, reject) {
                    var imagePaths = [];
                    for (var i = 0; i < Number(totalPages); i++) {
                        THIS.convertPage(i).then(function (imagePath) {
                            imagePaths.push(imagePath);
                            if (imagePaths.length === Number(totalPages)) {
                                imagePaths.sort(); // because of asyc pages we have to reSort pages
                                resolve(imagePaths);
                            }
                        }).catch(function (error) {
                            reject(error);
                        });
                    }
                });
                convertPromise.then(function (imagePaths) {
                    if (THIS._combinedImage) {
                        THIS.combineImages(imagePaths).then(function (imagePath) {
                            return resolve([imagePath]);
                        });
                    }
                    else {
                        resolve(imagePaths);
                    }
                }).catch(function (error) {
                    reject(error);
                });
            });
        });
    };
    PDFImage.prototype.convertPage = function (pageNumber) {
        var pdfFilePath = this._pdfFilePath;
        var outputImagePath = this.getOutputImagePathForPage(pageNumber);
        var convertCommand = this.constructConvertCommandForPage(pageNumber);
        return new Promise(function (resolve, reject) {
            var convertPageToImage = function () {
                child_process_1.exec(convertCommand, function (err, stdout, stderr) {
                    if (err) {
                        return reject({
                            message: "Failed to convert page to image",
                            error: err,
                            stdout: stdout,
                            stderr: stderr
                        });
                    }
                    return resolve(outputImagePath);
                });
            };
            fs_1.stat(outputImagePath, function (err, imageFileStat) {
                var imageNotExists = err && err.code === "ENOENT";
                if (!imageNotExists && err) {
                    return reject({
                        message: "Failed to stat image file",
                        error: err
                    });
                }
                // convert when (1) image doesn't exits or (2) image exists
                // but its timestamp is older than pdf's one
                if (imageNotExists) {
                    // (1)
                    convertPageToImage();
                    return;
                }
                // image exist. check timestamp.
                fs_1.stat(pdfFilePath, function (err, pdfFileStat) {
                    if (err) {
                        return reject({
                            message: "Failed to stat PDF file",
                            error: err
                        });
                    }
                    if (imageFileStat.mtime < pdfFileStat.mtime) {
                        // (2)
                        convertPageToImage();
                        return;
                    }
                    return resolve(outputImagePath);
                });
            });
        });
    };
    return PDFImage;
}());
exports.PDFImage = PDFImage;
